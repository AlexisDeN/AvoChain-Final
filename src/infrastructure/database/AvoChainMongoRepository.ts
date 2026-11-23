import { Collection, Db, Document, MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { Finca } from "../../domain/entities/FincaBuilder";
import { IncidenteRuta, Lote } from "../../domain/entities/Lote";

type StoredFinca = Document & { codigoInterno: string; productorId: ObjectId; datosAplicacion: Finca };
type StoredLote = Document & { codigoLote: string; fincaId: ObjectId; datosAplicacion: Lote };

export interface PaymentOrder {
  reference: string;
  email: string;
  amountInCents: number;
  currency: "COP";
  status: "PENDING" | "APPROVED" | "DECLINED" | "ERROR" | "VOIDED";
  transactionId?: string;
  metodo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AvoChainMongoRepository {
  private client: MongoClient;
  private db!: Db;
  private usuarios!: Collection<Document>;
  private fincas!: Collection<StoredFinca>;
  private lotes!: Collection<StoredLote>;
  private pagos!: Collection<PaymentOrder & Document>;
  private premium!: Collection<Document>;
  private solicitudes!: Collection<Document>;

  constructor(uri = process.env.MONGODB_URI || "mongodb://avoadmin:change-this-password@127.0.0.1:27018/avochain?authSource=admin") {
    this.client = new MongoClient(uri);
  }

  async conectar(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DATABASE || "avochain");
    this.usuarios = this.db.collection("usuarios");
    this.fincas = this.db.collection("fincas");
    this.lotes = this.db.collection("lotes");
    this.pagos = this.db.collection("pagosWompi");
    this.premium = this.db.collection("accesosPremium");
    this.solicitudes = this.db.collection("solicitudesVinculacion");
    await this.crearIndices();
  }

  async cerrar(): Promise<void> { await this.client.close(); }

  async crearOrdenPago(order: PaymentOrder): Promise<void> {
    await this.pagos.insertOne(order as PaymentOrder & Document);
  }

  async buscarOrdenPago(reference: string): Promise<PaymentOrder | null> {
    return this.pagos.findOne({ reference }) as Promise<PaymentOrder | null>;
  }

  async actualizarOrdenPago(reference: string, status: PaymentOrder["status"], transactionId?: string): Promise<void> {
    await this.pagos.updateOne({ reference }, { $set: { status, transactionId, updatedAt: new Date() } });
  }

  async buscarUltimaOrdenPago(email: string): Promise<PaymentOrder | null> {
    return this.pagos.find({ email: email.trim().toLowerCase() }).sort({ createdAt: -1 }).limit(1).next();
  }

  async activarPremium(email: string, reference: string, transactionId: string): Promise<void> {
    const correo = email.trim().toLowerCase();
    await this.premium.updateOne(
      { email: correo },
      { $set: { email: correo, activo: true, reference, transactionId, activadoEn: new Date() } },
      { upsert: true }
    );
  }

  async obtenerAccesoPremium(email: string): Promise<Document | null> {
    return this.premium.findOne({ email: email.trim().toLowerCase(), activo: true });
  }

  async tienePremium(email: string): Promise<boolean> {
    return Boolean(await this.obtenerAccesoPremium(email));
  }

  async crearSolicitudVinculacion(input: Record<string, unknown>): Promise<Document> {
    const email = String(input.email || "").trim().toLowerCase();
    if (await this.usuarios.findOne({ email })) throw new Error("Ya existe una cuenta asociada a ese correo.");
    if (await this.solicitudes.findOne({ email, estado: "Pendiente" })) throw new Error("Ya existe una solicitud pendiente con ese correo.");
    const solicitud = { ...input, email, estado: "Pendiente", fechaSolicitud: new Date() };
    const result = await this.solicitudes.insertOne(solicitud);
    return { _id: result.insertedId, ...solicitud };
  }

  async listarSolicitudesVinculacion(): Promise<Document[]> {
    return this.solicitudes.find({}).sort({ fechaSolicitud: -1 }).project({ documentos: { $map: { input: "$documentos", as: "doc", in: { nombreArchivo: "$$doc.nombreArchivo", mimeType: "$$doc.mimeType", sizeBytes: "$$doc.sizeBytes" } } } }).toArray();
  }

  async buscarSolicitudVinculacion(id: string): Promise<Document | null> {
    return ObjectId.isValid(id) ? this.solicitudes.findOne({ _id: new ObjectId(id) }) : null;
  }

  async buscarDocumentoSolicitud(id: string, indice: number): Promise<Document | null> {
    if (!ObjectId.isValid(id) || !Number.isInteger(indice) || indice < 0) return null;
    const solicitud = await this.solicitudes.findOne({ _id: new ObjectId(id) });
    const documento = (solicitud?.documentos as Document[] | undefined)?.[indice];
    return documento || null;
  }

  async crearCuentaPendiente(input: { solicitudId: string; email: string; nombre: string; rol: string; tokenHash: string; venceEn: Date; aprobadaPor: string }): Promise<Document> {
    const solicitudId = new ObjectId(input.solicitudId);
    const solicitud = await this.solicitudes.findOne({ _id: solicitudId, estado: "Pendiente" });
    if (!solicitud) throw new Error("La solicitud ya fue revisada o no existe.");
    if (await this.usuarios.findOne({ email: input.email.toLowerCase() })) throw new Error("Ya hay una cuenta con ese correo.");
    const usuario = {
      email: input.email.trim().toLowerCase(), nombre: input.nombre.trim(), rol: input.rol,
      walletAddress: `USR-${randomUUID()}`, estadoActivo: false, fechaRegistro: new Date(),
      tokenActivacionHash: input.tokenHash, tokenActivacionExpira: input.venceEn
    };
    const result = await this.usuarios.insertOne(usuario);
    await this.solicitudes.updateOne({ _id: solicitudId, estado: "Pendiente" }, { $set: { estado: "Aprobada", revisadaEn: new Date(), revisadaPor: input.aprobadaPor, usuarioId: result.insertedId } });
    return { _id: result.insertedId, ...usuario };
  }

  async rechazarSolicitudVinculacion(id: string, revisadaPor: string, motivo: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const result = await this.solicitudes.updateOne(
      { _id: new ObjectId(id), estado: "Pendiente" },
      { $set: { estado: "Rechazada", revisadaEn: new Date(), revisadaPor, motivoRechazo: motivo.trim() } }
    );
    return result.modifiedCount === 1;
  }

  async buscarUsuarioPorTokenActivacion(tokenHash: string): Promise<Document | null> {
    return this.usuarios.findOne({ tokenActivacionHash: tokenHash, tokenActivacionExpira: { $gt: new Date() }, estadoActivo: false });
  }

  async activarCuentaPorToken(tokenHash: string, passwordSalt: string, passwordHash: string): Promise<boolean> {
    const result = await this.usuarios.updateOne(
      { tokenActivacionHash: tokenHash, tokenActivacionExpira: { $gt: new Date() }, estadoActivo: false },
      { $set: { passwordSalt, passwordHash, estadoActivo: true, activadaEn: new Date() }, $unset: { tokenActivacionHash: "", tokenActivacionExpira: "" } }
    );
    return result.modifiedCount === 1;
  }

  async listarUsuarios(): Promise<Document[]> {
    return this.usuarios.find({}).sort({ fechaRegistro: -1 }).toArray();
  }

  async registrarUsuario(input: { walletAddress: string; nombre: string; rol: string }): Promise<Document> {
    const walletAddress = input.walletAddress.trim();
    const nombre = input.nombre.trim();
    const rol = input.rol.trim();
    if (!walletAddress || !nombre || !rol) throw new Error("Wallet, nombre y rol son obligatorios.");
    const result = await this.usuarios.findOneAndUpdate(
      { walletAddress },
      { $setOnInsert: { walletAddress, nombre, rol, estadoActivo: true, fechaRegistro: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    if (!result) throw new Error("No se pudo guardar el usuario.");
    if (result.rol !== rol || result.nombre !== nombre) throw new Error("La wallet ya está registrada. No se sobrescribieron su nombre ni su rol.");
    return result;
  }

  async buscarUsuarioPorCorreo(email: string): Promise<Document | null> {
    return this.usuarios.findOne({ email: email.trim().toLowerCase(), estadoActivo: true });
  }

  async buscarUsuarioPorId(id: string): Promise<Document | null> {
    return ObjectId.isValid(id) ? this.usuarios.findOne({ _id: new ObjectId(id), estadoActivo: true }) : null;
  }

  async crearCuentaUsuario(input: { email: string; passwordSalt: string; passwordHash: string; walletAddress: string; nombre: string; rol: string }): Promise<Document> {
    const email = input.email.trim().toLowerCase();
    const walletAddress = input.walletAddress.trim();
    const porCorreo = await this.usuarios.findOne({ email });
    if (porCorreo) {
      if (porCorreo.walletAddress === walletAddress && porCorreo.rol === input.rol) {
        if (!porCorreo.passwordHash) {
          await this.usuarios.updateOne({ _id: porCorreo._id }, { $set: { passwordSalt: input.passwordSalt, passwordHash: input.passwordHash, nombre: input.nombre.trim(), estadoActivo: true } });
          return { ...porCorreo, ...input, email, nombre: input.nombre.trim(), estadoActivo: true };
        }
        return porCorreo;
      }
      throw new Error("El correo ya está asociado a otra wallet o a otro rol. Revisa el usuario registrado.");
    }
    const legado = await this.usuarios.findOne({ walletAddress, email: { $exists: false } });
    if (legado) {
      await this.usuarios.updateOne({ _id: legado._id }, { $set: { email, passwordSalt: input.passwordSalt, passwordHash: input.passwordHash, nombre: input.nombre.trim(), rol: input.rol, estadoActivo: true } });
      return { ...legado, ...input, email, nombre: input.nombre.trim(), estadoActivo: true };
    }
    if (await this.usuarios.findOne({ walletAddress })) throw new Error("La wallet ya está asociada a otra cuenta.");
    const doc = { ...input, email, walletAddress, nombre: input.nombre.trim(), estadoActivo: true, fechaRegistro: new Date() };
    const result = await this.usuarios.insertOne(doc);
    return { _id: result.insertedId, ...doc };
  }

  async crearAdministradorInicial(input: { email: string; passwordSalt: string; passwordHash: string; walletAddress: string; nombre: string }): Promise<void> {
    const existing = await this.usuarios.findOne({ rol: "Administrador", email: { $exists: true } });
    if (existing) return;
    await this.crearCuentaUsuario({ ...input, rol: "Administrador" });
  }

  async buscarUsuariosPorRol(rol: string): Promise<Document[]> {
    return this.usuarios.find({ rol, estadoActivo: true }).project({ nombre: 1, walletAddress: 1, rol: 1 }).toArray();
  }

  async buscarUsuarioPorWallet(walletAddress: string): Promise<Document | null> {
    return this.usuarios.findOne({ walletAddress, estadoActivo: true });
  }

  async actualizarUsuario(id: string, changes: { nombre?: string; email?: string; rol?: string; estadoActivo?: boolean; passwordSalt?: string; passwordHash?: string }): Promise<Document | null> {
    if (!ObjectId.isValid(id)) return null;
    if (changes.email) {
      const duplicate = await this.usuarios.findOne({ email: changes.email.toLowerCase(), _id: { $ne: new ObjectId(id) } });
      if (duplicate) throw new Error("Ese correo ya pertenece a otra cuenta.");
    }
    const result = await this.usuarios.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: changes }, { returnDocument: "after" });
    return result;
  }

  async listarFincasProductor(walletAddress: string): Promise<Finca[]> {
    const users = await this.usuarios.find({ walletAddress }).project({ _id: 1 }).toArray();
    const docs = await this.fincas.find({ productorId: { $in: users.map((u) => u._id) } }).toArray();
    return docs.map((doc) => doc.datosAplicacion);
  }

  async fincaPerteneceProductor(codigoFinca: string, walletAddress: string): Promise<boolean> {
    const user = await this.usuarios.findOne({ walletAddress, rol: "Productor", estadoActivo: true });
    if (!user) return false;
    const finca = await this.fincas.findOne({ codigoInterno: codigoFinca, productorId: user._id });
    return Boolean(finca && finca.datosAplicacion.activa && (finca.datosAplicacion.estadoAprobacion || "Aprobada") === "Aprobada");
  }

  async guardarFinca(finca: Finca): Promise<Finca> {
    const productorId = await this.obtenerOCrearUsuario(finca.productorWallet || "0x819C...4U21", "Productor", finca.nombre);
    await this.fincas.updateOne(
      { codigoInterno: finca.id },
      { $set: { codigoInterno: finca.id, productorId, nombreFinca: finca.nombre, registroICA: finca.registroICA, ubicacionGPS: finca.gps, ...(finca.certificadoPdfUrl ? { certificadoICA_url: finca.certificadoPdfUrl } : {}), estado: finca.estadoAprobacion === "Pendiente" ? "Pendiente de aprobación" : finca.estadoAprobacion === "Rechazada" ? "Rechazada" : finca.activa ? "Activa" : "Inactiva", datosAplicacion: finca } },
      { upsert: true }
    );
    return finca;
  }

  async actualizarFinca(codigoInterno: string, changes: { nombre: string; registroICA: string; gps: string; wallet: string; activa: boolean }): Promise<Finca | null> {
    const stored = await this.fincas.findOne({ codigoInterno });
    if (!stored) return null;
    const producer = await this.usuarios.findOne({ walletAddress: changes.wallet, rol: "Productor", estadoActivo: true });
    if (!producer) throw new Error("Selecciona una cuenta activa con rol Productor.");
    const duplicateICA = await this.fincas.findOne({ registroICA: changes.registroICA, codigoInterno: { $ne: codigoInterno } });
    if (duplicateICA) throw new Error("Ese registro ICA ya pertenece a otra finca.");
    const finca: Finca = { ...stored.datosAplicacion, nombre: changes.nombre.trim(), registroICA: changes.registroICA.trim(), gps: changes.gps.trim(), productorWallet: changes.wallet, activa: changes.activa, estadoAprobacion: changes.activa ? "Aprobada" : (stored.datosAplicacion.estadoAprobacion || "Aprobada") };
    await this.fincas.updateOne({ codigoInterno }, { $set: {
      productorId: producer._id, nombreFinca: finca.nombre, registroICA: finca.registroICA, ubicacionGPS: finca.gps,
      estado: finca.estadoAprobacion === "Pendiente" ? "Pendiente de aprobación" : finca.estadoAprobacion === "Rechazada" ? "Rechazada" : finca.activa ? "Activa" : "Inactiva", datosAplicacion: finca
    } });
    return finca;
  }

  async buscarFinca(id: string): Promise<Finca | undefined> {
    const finca = await this.fincas.findOne({ codigoInterno: id });
    return finca?.datosAplicacion;
  }

  async aprobarFinca(codigoInterno: string): Promise<Finca | null> {
    const stored = await this.fincas.findOne({ codigoInterno, "datosAplicacion.estadoAprobacion": "Pendiente" });
    if (!stored) return null;
    const finca = { ...stored.datosAplicacion, activa: true, estadoAprobacion: "Aprobada" as const };
    await this.fincas.updateOne({ _id: stored._id }, { $set: { estado: "Activa", datosAplicacion: finca, aprobadaEn: new Date() } });
    return finca;
  }

  async listarFincas(): Promise<Finca[]> {
    const docs = await this.fincas.find().toArray();
    return docs.map((doc) => doc.datosAplicacion);
  }

  async guardarLote(lote: Lote): Promise<Lote> {
    const finca = await this.fincas.findOne({ codigoInterno: lote.fincaId });
    if (!finca) throw new Error("La finca referenciada no existe en MongoDB.");
    const productorId = await this.obtenerOCrearUsuario(lote.productorWallet, "Productor", lote.productorWallet);
    const doc: StoredLote = {
      codigoLote: lote.id,
      hashBlockchain_registro: lote.txHashRegistro,
      estadoActual: lote.estado,
      fincaId: finca._id,
      datosProduccion: {
        productorId, pesoKg: lote.pesoKg, variedad: lote.variedad, fechaCosecha: new Date(lote.fechaCosecha),
        evidenciaFotografica: lote.evidencias.map((e) => ({ url: e.url, formato: e.mimeType === "image/png" ? "PNG" : "JPG", pesoMB: e.sizeBytes / (1024 * 1024) }))
      },
      inspeccionCalidad: lote.inspeccionCalidad ? {
        inspectorId: await this.obtenerOCrearUsuario(lote.inspeccionCalidad.inspectorId, "Inspector de calidad", lote.inspeccionCalidad.inspectorId),
        humedad: lote.inspeccionCalidad.humedad, temperatura: lote.inspeccionCalidad.temperaturaC,
        reportePDF_url: lote.inspeccionCalidad.informePdfUrl, aprobado: lote.inspeccionCalidad.aprobada,
        fechaInspeccion: new Date(lote.inspeccionCalidad.firmadoEn), destino: lote.inspeccionCalidad.destino,
        evaluacionFitosanitaria: lote.inspeccionCalidad.evaluacionFitosanitaria, reportePDF_pesoBytes: lote.inspeccionCalidad.informePdfSizeBytes,
        hashInforme: lote.inspeccionCalidad.hashInforme
      } : undefined,
      codigoQR: lote.qrGenerado ? { empacadorId: await this.obtenerOCrearUsuario("EMPACADORA-DEMO", "Bodeguero", "Empacadora"), urlImagenS3: "", fechaGeneracion: new Date() } : undefined,
      despacho: lote.conductorId ? {
        jefeBodegaId: await this.obtenerOCrearUsuario("BODEGA-DEMO", "Bodeguero", "Bodega"),
        transportistaId: await this.obtenerOCrearUsuario(lote.conductorId, "Transportista", lote.conductorId),
        hashBlockchain_despacho: [...lote.eventos].reverse().find((e) => e.tipo === "Despacho")?.txHash || "",
        fechaSalida: new Date([...lote.eventos].reverse().find((e) => e.tipo === "Despacho")?.fecha || Date.now())
      } : undefined,
      incidentesRuta: await Promise.all(lote.incidentes.map(async (i) => ({
        transportistaId: await this.obtenerOCrearUsuario(i.conductorId, "Transportista", i.conductorId),
        tipoIncidente: i.tipo, descripcion: i.comentario,
        ...(i.ubicacion ? { ubicacion: { latitud: i.ubicacion.latitud, longitud: i.ubicacion.longitud, ...(i.ubicacion.referencia ? { referencia: i.ubicacion.referencia } : {}) } } : {}),
        ...(i.fotoUrl ? { fotoEvidencia_url: i.fotoUrl } : {}), fechaReporte: new Date(i.creadoEn)
      }))),
      puntosControlRuta: lote.puntosControlRuta || [],
      recepcionDestino: lote.recepcionDestino ? {
        receptorId: await this.obtenerOCrearUsuario(lote.recepcionDestino.recibidoPor, "Receptor", lote.recepcionDestino.recibidoPor),
        temperaturaLlegada: lote.recepcionDestino.temperaturaC, cajasDanadas: lote.recepcionDestino.cajasDanadas,
        hashBlockchain_recepcion: [...lote.eventos].reverse().find((e) => e.tipo === "RecepcionDestino")?.txHash || "",
        fechaLlegada: new Date(lote.recepcionDestino.recibidoEn), temperaturaMaximaRuta: lote.recepcionDestino.temperaturaMaximaRutaC
      } : undefined,
      ventaFinal: lote.estado === "Vendido" ? {
        vendedorId: await this.obtenerOCrearUsuario("VENDEDOR-DEMO", "Vendedor", "Vendedor"),
        hashBlockchain_quema: [...lote.eventos].reverse().find((e) => e.tipo === "Venta")?.txHash || "",
        fechaVenta: new Date([...lote.eventos].reverse().find((e) => e.tipo === "Venta")?.fecha || Date.now())
      } : undefined,
      incidentes: lote.incidentes, eventos: lote.eventos, conductorId: lote.conductorId,
      rutaDespacho: lote.rutaDespacho,
      qrGenerado: lote.qrGenerado, qrImpreso: lote.qrImpreso, productorWallet: lote.productorWallet,
      txHashRegistro: lote.txHashRegistro, datosAplicacion: lote
    };
    for (const [key, value] of Object.entries(doc)) if (value === undefined) delete doc[key];
    await this.lotes.updateOne({ codigoLote: lote.id }, { $set: doc }, { upsert: true });
    return lote;
  }

  async buscarLote(id: string): Promise<Lote | undefined> {
    const lote = await this.lotes.findOne({ codigoLote: id });
    return lote?.datosAplicacion;
  }

  async listarLotes(filtro: Document = {}): Promise<Lote[]> {
    const docs = await this.lotes.find(filtro).toArray();
    return docs.map((doc) => doc.datosAplicacion);
  }

  async eliminarLote(id: string): Promise<void> {
    const result = await this.lotes.deleteOne({ codigoLote: id });
    if (!result.deletedCount) throw new Error("Producto Falso o No Registrado.");
  }

  async agregarIncidente(id: string, incidente: IncidenteRuta): Promise<Lote> {
    const lote = await this.requireLote(id);
    lote.incidentes.push(incidente);
    return this.guardarLote(lote);
  }

  async requireLote(id: string): Promise<Lote> {
    const lote = await this.buscarLote(id);
    if (!lote) throw new Error("Producto Falso o No Registrado.");
    return lote;
  }

  private async obtenerOCrearUsuario(walletAddress: string, rol: string, nombre: string): Promise<ObjectId> {
    const result = await this.usuarios.findOneAndUpdate(
      { walletAddress },
      { $setOnInsert: { walletAddress, nombre, rol, estadoActivo: true, fechaRegistro: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    return result?._id as ObjectId;
  }

  private async crearIndices(): Promise<void> {
    await Promise.all([
      this.usuarios.createIndex({ walletAddress: 1 }, { unique: true }),
      this.usuarios.createIndex({ email: 1 }, { unique: true, sparse: true }),
      this.fincas.createIndex({ codigoInterno: 1 }, { unique: true }),
      this.fincas.createIndex({ registroICA: 1 }, { unique: true }),
      this.lotes.createIndex({ codigoLote: 1 }, { unique: true }),
      this.lotes.createIndex({ fincaId: 1, estadoActual: 1 }),
      this.pagos.createIndex({ reference: 1 }, { unique: true }),
      this.pagos.createIndex({ email: 1, status: 1 }),
      this.premium.createIndex({ email: 1 }, { unique: true }),
      this.solicitudes.createIndex({ email: 1, estado: 1 })
    ]);
  }

}
