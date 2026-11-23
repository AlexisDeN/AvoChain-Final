import { createHash, randomBytes } from "node:crypto";
import { esRolAsignable } from "../../domain/access/Rol";
import { AvoChainMongoRepository } from "../../infrastructure/database/AvoChainMongoRepository";
import { SmtpMailer } from "../../infrastructure/email/SmtpMailer";

const MAX_BYTES = 2 * 1024 * 1024;
const TIPOS = new Set(["application/pdf", "image/jpeg", "image/png"]);
type DocumentoEntrada = { nombreArchivo: string; mimeType: string; contenidoBase64: string };

export class VinculacionService {
  constructor(private repo: AvoChainMongoRepository, private mailer: SmtpMailer) {}
  async solicitar(input: Record<string, unknown>) {
    const email = String(input.email || "").trim().toLowerCase();
    const nombre = String(input.nombre || "").trim();
    const rol = String(input.rol || "");
    const documentos = Array.isArray(input.documentos) ? input.documentos as DocumentoEntrada[] : [];
    if (!nombre || nombre.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !esRolAsignable(rol)) throw new Error("Completa nombre, correo válido y un rol permitido.");
    if (input.aceptaTratamiento !== true) throw new Error("Debes aceptar el tratamiento de datos para enviar la solicitud.");
    if (documentos.length < 1 || documentos.length > 3) throw new Error("Adjunta entre 1 y 3 documentos PDF, JPG o PNG.");
    const files = documentos.map((doc) => {
      if (!TIPOS.has(doc.mimeType)) throw new Error("Solo se permiten documentos PDF, JPG o PNG.");
      const base64 = String(doc.contenidoBase64 || "");
      if (!base64 || base64.length > Math.ceil(MAX_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
        throw new Error("El documento adjunto no tiene un contenido Base64 válido.");
      }
      const contenido = Buffer.from(base64, "base64");
      if (!contenido.length || contenido.length > MAX_BYTES) throw new Error("Cada documento debe pesar máximo 2 MB.");
      const firmaValida = doc.mimeType === "application/pdf"
        ? contenido.subarray(0, 5).toString("ascii") === "%PDF-"
        : doc.mimeType === "image/png"
          ? contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : contenido.length >= 3 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff;
      if (!firmaValida) throw new Error(`${String(doc.nombreArchivo || "El archivo")}: el contenido no coincide con el formato declarado.`);
      return { nombreArchivo: String(doc.nombreArchivo || "documento").replace(/[\\/\r\n]/g, "_").slice(0, 120), mimeType: doc.mimeType, sizeBytes: contenido.length, contenido };
    });
    const solicitud = await this.repo.crearSolicitudVinculacion({ nombre, email, rol, telefono: String(input.telefono || "").slice(0, 40), documentoIdentidad: String(input.documentoIdentidad || "").slice(0, 50), municipio: String(input.municipio || "").slice(0, 100), finca: String(input.finca || "").slice(0, 120), motivo: String(input.motivo || "").slice(0, 1000), documentos: files });
    return { mensaje: "Solicitud enviada para revisión administrativa.", solicitudId: String(solicitud._id), estado: "Pendiente" };
  }
  listar() { return this.repo.listarSolicitudesVinculacion(); }
  async documento(id: string, indice: number) { return this.repo.buscarDocumentoSolicitud(id, indice); }
  async aprobar(id: string, adminEmail: string) {
    this.mailer.validarConfiguracion();
    const solicitud = await this.repo.buscarSolicitudVinculacion(id);
    if (!solicitud || solicitud.estado !== "Pendiente") throw new Error("La solicitud no existe o ya fue revisada.");
    const token = randomBytes(32).toString("base64url");
    const url = `${(process.env.APP_BASE_URL || "http://localhost:3001").replace(/\/$/, "")}/?activar-cuenta=${encodeURIComponent(token)}`;
    const hash = createHash("sha256").update(token).digest("hex");
    await this.repo.crearCuentaPendiente({ solicitudId: id, email: String(solicitud.email), nombre: String(solicitud.nombre), rol: String(solicitud.rol), tokenHash: hash, venceEn: new Date(Date.now() + 24 * 60 * 60 * 1000), aprobadaPor: adminEmail });
    try {
      const resultado = await this.mailer.enviarActivacion(String(solicitud.email), String(solicitud.nombre), url);
      return { mensaje: resultado.enviado ? "Solicitud aprobada; se envió el enlace de activación al correo." : "Solicitud aprobada. En modo local, el enlace de activación quedó en la consola del servidor.", correoEnviado: resultado.enviado, ...(resultado.enviado ? {} : { enlaceActivacionDemo: url }) };
    } catch (error) {
      // La cuenta ya fue aprobada; el admin puede reenviar desde el flujo de recuperación.
      throw new Error(`La cuenta fue creada, pero no se pudo enviar el correo: ${error instanceof Error ? error.message : "error SMTP"}`);
    }
  }
  async rechazar(id: string, adminEmail: string, motivo: string) {
    if (!motivo.trim()) throw new Error("Escribe el motivo del rechazo.");
    if (!await this.repo.rechazarSolicitudVinculacion(id, adminEmail, motivo)) throw new Error("La solicitud no existe o ya fue revisada.");
    return { mensaje: "Solicitud rechazada." };
  }
}
