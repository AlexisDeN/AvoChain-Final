// Crea/actualiza un conjunto repetible de datos de práctica sin borrar datos existentes.
// Ejecutar desde la raíz del proyecto: npm run seed:demo
require("dotenv").config();

const { createHash, randomBytes, scryptSync } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");

const uri = process.env.MONGODB_URI || "mongodb://avoadmin:change-this-password@127.0.0.1:27018/avochain?authSource=admin";
const databaseName = process.env.MONGODB_DATABASE || "avochain";
const demoPassword = "1234567890";
const roleGroups = [
  ["Productor", 10], ["Transportador", 8], ["Inspector de calidad", 6],
  ["Bodeguero", 5], ["Receptor", 5], ["Vendedor", 6]
];
const firstNames = ["Valentina", "Santiago", "Isabella", "Mateo", "Camila", "Samuel", "Mariana", "Nicolas", "Luciana", "Gabriel", "Salome", "Daniel", "Antonella", "Sebastian", "Victoria", "Emiliano", "Gabriela", "Martin", "Julieta", "Andres", "Manuela", "David", "Renata", "Tomas", "Sara", "Jeronimo", "Laura", "Felipe", "Paula", "Alejandro", "Catalina", "Juan", "Elena", "Miguel", "Clara", "Esteban", "Mia", "Simon", "Eva", "Joaquin"];
const lastNames = ["Gomez", "Rodriguez", "Martinez", "Lopez", "Garcia", "Hernandez", "Ramirez", "Torres", "Diaz", "Vargas", "Castro", "Rojas", "Moreno", "Jimenez", "Ruiz"];
const farmNames = ["Las Palmas", "El Porvenir", "La Esperanza", "Monteverde", "El Roble", "Santa Elena", "Los Naranjos", "La Primavera", "El Paraiso", "Villa Clara", "San Miguel", "La Cumbre", "El Encanto", "Buenavista", "Los Arrayanes"];
const statuses = ["Registrado", "Aprobado_Calidad", "Rechazado_En_Origen", "En Transito", "En Punto de Venta", "Vendido"];
const incidentTypes = ["Camion varado", "Choque", "Trancon por vias cerradas", "Via cerrada", "Derrumbe", "Falla mecanica", "Clima adverso"];
const routeExamples = [
  ["Pereira, Risaralda", "Bogota D.C."], ["Armenia, Quindio", "Medellin, Antioquia"],
  ["Cali, Valle del Cauca", "Bogota D.C."], ["Manizales, Caldas", "Ibague, Tolima"],
  ["Popayan, Cauca", "Pasto, Narino"], ["Neiva, Huila", "Bogota D.C."],
  ["Bucaramanga, Santander", "Cucuta, Norte de Santander"], ["Villavicencio, Meta", "Bogota D.C."],
  ["Tunja, Boyaca", "Duitama, Boyaca"], ["Medellin, Antioquia", "Cartagena, Bolivar"],
  ["Pereira, Risaralda", "Barranquilla, Atlantico"], ["Armenia, Quindio", "Cali, Valle del Cauca"]
];
const randomHex = (value, length = 40) => createHash("sha256").update(value).digest("hex").slice(0, length).toUpperCase();
const dateDaysAgo = (days, hour = 9) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};
const dateIsoDaysAgo = (days, hour = 9) => dateDaysAgo(days, hour).toISOString();

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(databaseName);
    const usersCollection = db.collection("usuarios");
    const farmsCollection = db.collection("fincas");
    const lotsCollection = db.collection("lotes");

    const users = [];
    let ordinal = 0;
    for (const [rol, quantity] of roleGroups) {
      for (let index = 0; index < quantity; index += 1) {
        const number = String(index + 1).padStart(2, "0");
        const email = `demo.${rol.toLowerCase().replaceAll(" ", "-")}.${number}@avochain.local`;
        const walletAddress = `0x${randomHex(email)}`;
        const nombre = `${firstNames[ordinal % firstNames.length]} ${lastNames[ordinal % lastNames.length]}`;
        const passwordSalt = randomBytes(16).toString("hex");
        const passwordHash = scryptSync(demoPassword, passwordSalt, 64).toString("hex");
        await usersCollection.updateOne(
          { email },
          { $set: { email, walletAddress, nombre, rol, passwordSalt, passwordHash, estadoActivo: true }, $setOnInsert: { fechaRegistro: dateDaysAgo(120 - ordinal) } },
          { upsert: true }
        );
        const user = await usersCollection.findOne({ email });
        users.push(user);
        ordinal += 1;
      }
    }

    const byRole = (rol) => users.filter((user) => user.rol === rol);
    const producers = byRole("Productor");
    const carriers = byRole("Transportador");
    const inspectors = byRole("Inspector de calidad");
    const warehouse = byRole("Bodeguero");
    const receivers = byRole("Receptor");
    const sellers = byRole("Vendedor");

    const farms = [];
    for (let index = 0; index < farmNames.length; index += 1) {
      const id = `DEMO-FINCA-${String(index + 1).padStart(3, "0")}`;
      const producer = producers[index % producers.length];
      const gps = `${(1.2 + index * 0.17).toFixed(4)},${(-76.8 + index * 0.13).toFixed(4)}`;
      const registroICA = `ICA-DEMO-${String(2026001 + index)}-C${String(index + 1).padStart(4, "0")}`;
      const finca = {
        id, nombre: `Finca ${farmNames[index]}`, registroICA, gps,
        activa: index % 10 !== 9, productorWallet: producer.walletAddress,
        certificadoPdfUrl: `https://ejemplo.invalid/certificados/${id}.pdf`
      };
      await farmsCollection.updateOne(
        { codigoInterno: id },
        { $set: {
          productorId: producer._id, nombreFinca: finca.nombre, registroICA,
          ubicacionGPS: gps, certificadoICA_url: finca.certificadoPdfUrl,
          estado: finca.activa ? "Activa" : "Inactiva", datosAplicacion: finca, demoAvoChain: true
        }, $setOnInsert: { _id: new ObjectId() } },
        { upsert: true }
      );
      const storedFarm = await farmsCollection.findOne({ codigoInterno: id });
      farms.push({ ...finca, mongoId: storedFarm._id, productor: producer });
    }

    const lotDocuments = [];
    for (let index = 0; index < 120; index += 1) {
      const status = statuses[Math.floor(index / 20)];
      const farm = farms[index % farms.length];
      const producer = farm.productor;
      const inspector = inspectors[index % inspectors.length];
      const carrier = carriers[index % carriers.length];
      const warehouseUser = warehouse[index % warehouse.length];
      const receiver = receivers[index % receivers.length];
      const seller = sellers[index % sellers.length];
      const id = `DEMO-AVO-${String(index + 1).padStart(4, "0")}`;
      const harvestDate = dateIsoDaysAgo(70 - (index % 60), 6);
      const qualityDate = dateIsoDaysAgo(60 - (index % 50), 8);
      const hasQuality = status !== "Registrado";
      const approved = status !== "Rechazado_En_Origen";
      const humidity = approved ? 61 + (index % 9) : 72 + (index % 5);
      const qualityTemp = approved ? 4 + (index % 5) : 9 + (index % 3);
      const hasCarrier = ["En Transito", "En Punto de Venta", "Vendido"].includes(status);
      const received = ["En Punto de Venta", "Vendido"].includes(status);
      const sold = status === "Vendido";
      const endpoints = routeExamples[index % routeExamples.length];
      const route = hasCarrier ? {
        origenMunicipio: endpoints[0], destinoMunicipio: endpoints[1],
        ...(index % 2 === 0 ? { destinoDetalle: `Centro de distribucion, recibo ${String((index % 40) + 1).padStart(2, "0")}` } : {}),
        asignadaEn: dateIsoDaysAgo(30 - (index % 18), 9)
      } : undefined;
      const needsIncidents = index % 3 === 0 || index % 11 === 0 || (status === "En Transito" && index % 4 === 1);
      const incidents = needsIncidents ? [{
        id: `demo-incidente-${index + 1}`,
        tipo: incidentTypes[index % incidentTypes.length],
        comentario: `Evento de práctica en ruta para el lote ${id}.`,
        conductorId: carrier.walletAddress,
        ubicacion: { latitud: 4.4 + (index % 20) * 0.025, longitud: -75.8 + (index % 20) * 0.02, referencia: `Punto de control ${1 + (index % 8)}` },
        fotoUrl: `https://ejemplo.invalid/incidentes/${id}.jpg`,
        creadoEn: dateIsoDaysAgo(35 - (index % 25), 14)
      }] : [];
      const checkpoints = hasCarrier ? Array.from({ length: 2 + (index % 3) }, (_, checkpointIndex) => ({
        id: `demo-punto-${index + 1}-${checkpointIndex + 1}`,
        conductorId: carrier.walletAddress,
        ubicacion: { latitud: 4.2 + (index % 20) * 0.02 + checkpointIndex * 0.015, longitud: -75.9 + (index % 20) * 0.018 + checkpointIndex * 0.012, referencia: `Control vial ${checkpointIndex + 1}` },
        observacion: checkpointIndex === 0 ? "Salida de la empacadora." : `Punto de seguimiento ${checkpointIndex + 1}.`,
        registradoEn: dateIsoDaysAgo(30 - (index % 18) + checkpointIndex, 10 + checkpointIndex),
        txHash: `0xcheckpoint${String(index + 1).padStart(4, "0")}${checkpointIndex + 1}`
      })) : [];
      const maxRouteTemp = received && index % 5 === 0 ? 13 + (index % 3) : 7 + (index % 5);
      const arrivalTemperature = received ? 4 + (index % 7) : undefined;
      const damagedBoxes = received ? index % 9 === 0 ? 2 : index % 4 === 0 ? 1 : 0 : undefined;
      const events = [{ tipo: "Registro", actor: producer.walletAddress, fecha: harvestDate, detalle: "Lote demo registrado para consulta y práctica.", txHash: `0xregistro${String(index + 1).padStart(6, "0")}` }];
      if (hasQuality) events.push({ tipo: "InspeccionCalidad", actor: inspector.walletAddress, fecha: qualityDate, detalle: approved ? "Inspección de calidad aprobada." : "Lote rechazado por parámetros fuera de norma.", txHash: `0xcalidad${String(index + 1).padStart(6, "0")}` });
      if (hasCarrier) events.push({ tipo: "Despacho", actor: warehouseUser.walletAddress, fecha: dateIsoDaysAgo(30 - (index % 18), 9), detalle: `Despachado con ${carrier.nombre}.`, txHash: `0xdespacho${String(index + 1).padStart(6, "0")}` });
      for (const incident of incidents) events.push({ tipo: "Incidente", actor: carrier.walletAddress, fecha: incident.creadoEn, detalle: incident.tipo, txHash: `0xincidente${String(index + 1).padStart(6, "0")}` });
      if (received) events.push({ tipo: "RecepcionDestino", actor: receiver.walletAddress, fecha: dateIsoDaysAgo(14 - (index % 10), 8), detalle: maxRouteTemp > 12 ? `Recibido con alerta: temperatura máxima de ruta ${maxRouteTemp}°C.` : "Recibido conforme en destino.", txHash: `0xrecepcion${String(index + 1).padStart(6, "0")}` });
      if (sold) events.push({ tipo: "Venta", actor: seller.walletAddress, fecha: dateIsoDaysAgo(4 - (index % 4), 11), detalle: "Venta de práctica registrada; QR invalidado.", txHash: `0xventa${String(index + 1).padStart(6, "0")}` });

      const lot = {
        id, pesoKg: 350 + (index * 137) % 2600, variedad: index % 5 === 0 ? "Fuerte" : "Hass",
        fechaCosecha: harvestDate, fincaId: farm.id, estado: status, productorWallet: producer.walletAddress,
        ...(hasCarrier ? { conductorId: carrier.walletAddress } : {}),
        ...(route ? { rutaDespacho: route } : {}),
        qrGenerado: hasCarrier || received || sold, qrImpreso: hasCarrier || received || sold,
        txHashRegistro: `0xregistro${String(index + 1).padStart(6, "0")}`,
        evidencias: [{ id: `demo-evidencia-${index + 1}`, filename: `${id}-cosecha.jpg`, mimeType: "image/jpeg", sizeBytes: 250000 + index * 97, url: `https://ejemplo.invalid/evidencias/${id}.jpg` }],
        incidentes: incidents, puntosControlRuta: checkpoints, eventos: events,
        ...(hasQuality ? { inspeccionCalidad: {
          humedad: humidity, temperaturaC: qualityTemp, evaluacionFitosanitaria: approved ? "Aprobado" : "No cumple requisitos fitosanitarios",
          destino: index % 2 ? "Exportacion" : "Nacional", aprobada: approved, informePdfUrl: `https://ejemplo.invalid/reportes/${id}.pdf`,
          informePdfSizeBytes: 350000 + index * 131, firmadoEn: qualityDate, inspectorId: inspector.walletAddress,
          hashInforme: `sha256:demo-${String(index + 1).padStart(6, "0")}`
        } } : {}),
        ...(received ? { recepcionDestino: {
          temperaturaC: arrivalTemperature, cajasDanadas: damagedBoxes, temperaturaMaximaRutaC: maxRouteTemp,
          recibidoPor: receiver.walletAddress, recibidoEn: dateIsoDaysAgo(14 - (index % 10), 8)
        } } : {}),
        demoAvoChain: true
      };

      const doc = {
        codigoLote: id, hashBlockchain_registro: lot.txHashRegistro, estadoActual: status,
        fincaId: farm.mongoId,
        datosProduccion: {
          productorId: producer._id, pesoKg: lot.pesoKg, variedad: lot.variedad,
          fechaCosecha: new Date(harvestDate),
          evidenciaFotografica: lot.evidencias.map((photo) => ({ url: photo.url, formato: "JPG", pesoMB: photo.sizeBytes / (1024 * 1024) }))
        },
        ...(hasQuality ? { inspeccionCalidad: {
          inspectorId: inspector._id, humedad: humidity, temperatura: qualityTemp,
          reportePDF_url: lot.inspeccionCalidad.informePdfUrl, aprobado: approved,
          fechaInspeccion: new Date(qualityDate), destino: lot.inspeccionCalidad.destino,
          evaluacionFitosanitaria: lot.inspeccionCalidad.evaluacionFitosanitaria,
          reportePDF_pesoBytes: lot.inspeccionCalidad.informePdfSizeBytes, hashInforme: lot.inspeccionCalidad.hashInforme
        } } : {}),
        ...(lot.qrGenerado ? { codigoQR: { empacadorId: warehouseUser._id, urlImagenS3: `https://ejemplo.invalid/qr/${id}.png`, fechaGeneracion: dateDaysAgo(30 - (index % 18), 9) } } : {}),
        ...(hasCarrier ? { despacho: { jefeBodegaId: warehouseUser._id, transportistaId: carrier._id, hashBlockchain_despacho: `0xdespacho${String(index + 1).padStart(6, "0")}`, fechaSalida: dateDaysAgo(30 - (index % 18), 9) } } : {}),
        incidentesRuta: incidents.map((incident) => ({
          transportistaId: carrier._id, tipoIncidente: incident.tipo, descripcion: incident.comentario,
          ubicacion: incident.ubicacion, fotoEvidencia_url: incident.fotoUrl, fechaReporte: new Date(incident.creadoEn)
        })),
        puntosControlRuta: checkpoints,
        ...(received ? { recepcionDestino: {
          receptorId: receiver._id, temperaturaLlegada: arrivalTemperature, cajasDanadas: damagedBoxes,
          hashBlockchain_recepcion: `0xrecepcion${String(index + 1).padStart(6, "0")}`,
          fechaLlegada: dateDaysAgo(14 - (index % 10), 8), temperaturaMaximaRuta: maxRouteTemp,
          alertaTemperatura: maxRouteTemp > 12
        } } : {}),
        ...(sold ? { ventaFinal: { vendedorId: seller._id, hashBlockchain_quema: `0xventa${String(index + 1).padStart(6, "0")}`, fechaVenta: dateDaysAgo(4 - (index % 4), 11) } } : {}),
        productorWallet: producer.walletAddress, ...(hasCarrier ? { conductorId: carrier.walletAddress } : {}),
        ...(route ? { rutaDespacho: route } : {}),
        txHashRegistro: lot.txHashRegistro, qrGenerado: lot.qrGenerado, qrImpreso: lot.qrImpreso,
        incidentes: lot.incidentes, eventos: lot.eventos, datosAplicacion: lot, demoAvoChain: true
      };
      lotDocuments.push(doc);
    }

    if (lotDocuments.length) {
      await lotsCollection.bulkWrite(lotDocuments.map((doc) => ({
        updateOne: { filter: { codigoLote: doc.codigoLote }, update: { $set: doc, $setOnInsert: { _id: new ObjectId() } }, upsert: true }
      })), { ordered: true });
    }

    await Promise.all([
      usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true }),
      farmsCollection.createIndex({ codigoInterno: 1 }, { unique: true }),
      farmsCollection.createIndex({ registroICA: 1 }, { unique: true }),
      lotsCollection.createIndex({ codigoLote: 1 }, { unique: true }),
      lotsCollection.createIndex({ fincaId: 1, estadoActual: 1 })
    ]);

    const demoCounts = await Promise.all([
      usersCollection.countDocuments({ email: /^demo\./ }),
      farmsCollection.countDocuments({ demoAvoChain: true }),
      lotsCollection.countDocuments({ demoAvoChain: true })
    ]);
    console.log(`Datos demo preparados en ${databaseName}: ${demoCounts[0]} usuarios, ${demoCounts[1]} fincas y ${demoCounts[2]} lotes.`);
    console.log(`Contraseña de todas las cuentas demo: ${demoPassword}`);
    console.log("Los documentos de demo se identifican con demoAvoChain:true. No se borraron documentos existentes.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`No se pudieron crear los datos demo: ${error.message}`);
  process.exitCode = 1;
});
