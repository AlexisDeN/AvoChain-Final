import nodemailer from "nodemailer";

export class SmtpMailer {
  validarConfiguracion(): void {
    if (process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !(process.env.SMTP_FROM || process.env.SMTP_USER))) {
      throw new Error("El correo no está configurado. Define SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM antes de aprobar solicitudes.");
    }
  }
  async enviarActivacion(email: string, nombre: string, url: string): Promise<{ enviado: boolean }> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;
    if (!host || !user || !pass || !from) {
      this.validarConfiguracion();
      console.info(`[AvoChain demo] Enlace de activación para ${email}: ${url}`);
      return { enviado: false };
    }
    const transporter = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === "true", auth: { user, pass } });
    await transporter.sendMail({
      from, to: email, subject: "Tu cuenta AvoChain fue aprobada",
      text: `Hola ${nombre}, tu solicitud fue aprobada. Tu usuario para iniciar sesión es ${email}. Activa la cuenta y crea tu contraseña desde este enlace (válido por 24 horas): ${url}`,
      html: `<p>Hola ${this.escape(nombre)},</p><p>Tu solicitud de acceso a AvoChain fue aprobada.</p><p>Tu usuario para iniciar sesión es <strong>${this.escape(email)}</strong>.</p><p><a href="${url}">Activar cuenta y crear contraseña</a></p><p>Este enlace vence en 24 horas. Si no lo solicitaste, ignora este mensaje.</p>`
    });
    return { enviado: true };
  }
  private escape(value: string): string { return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!)); }
}
