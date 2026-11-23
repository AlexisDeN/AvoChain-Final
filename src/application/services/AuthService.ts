import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { esRol, normalizarRol } from "../../domain/access/Rol";
import { UsuarioSesion } from "../../domain/entities/Usuario";
import { AvoChainMongoRepository } from "../../infrastructure/database/AvoChainMongoRepository";

export type AuthUser = UsuarioSesion;

export class AuthService {
  private secret = process.env.AUTH_TOKEN_SECRET || "";
  constructor(private repository: AvoChainMongoRepository) {}

  async iniciarSesion(emailInput: unknown, passwordInput: unknown) {
    const email = String(emailInput || "").trim().toLowerCase();
    const password = String(passwordInput || "");
    if (!email || !password) throw new Error("Correo y contraseña son obligatorios.");
    const user = await this.repository.buscarUsuarioPorCorreo(email);
    if (!user?.passwordHash || !user.passwordSalt || !this.passwordValido(password, String(user.passwordSalt), String(user.passwordHash))) {
      throw new Error("Correo o contraseña incorrectos.");
    }
    const rol = normalizarRol(user.rol);
    if (!esRol(rol)) throw new Error("La cuenta tiene un rol no reconocido.");
    const profile: AuthUser = { id: String(user._id), email, nombre: String(user.nombre), walletAddress: String(user.walletAddress), rol };
    return { token: this.emitirToken(profile), usuario: profile };
  }

  async activarCuenta(tokenInput: unknown, passwordInput: unknown) {
    const token = String(tokenInput || "");
    const password = String(passwordInput || "");
    if (token.length < 32 || password.length < 10) throw new Error("El enlace no es válido y la contraseña debe tener al menos 10 caracteres.");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const pendiente = await this.repository.buscarUsuarioPorTokenActivacion(tokenHash);
    if (!pendiente) throw new Error("El enlace de activación venció o ya fue utilizado. Contacta al administrador.");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    if (!await this.repository.activarCuentaPorToken(tokenHash, salt, hash)) throw new Error("No se pudo activar la cuenta; solicita un enlace nuevo.");
    return { mensaje: "Cuenta activada. Ya puedes iniciar sesión con tu correo y contraseña." };
  }

  verificarToken(token: string): AuthUser | null {
    if (!this.secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const expected = this.firmar(body);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (payload.exp < Date.now() || !esRol(payload.rol)) return null;
      return { id: payload.sub, email: payload.email, nombre: payload.nombre, walletAddress: payload.walletAddress, rol: payload.rol };
    } catch { return null; }
  }

  async cargarSesionVigente(id: string): Promise<AuthUser | null> {
    const user = await this.repository.buscarUsuarioPorId(id);
    if (!user) return null;
    const rol = normalizarRol(user.rol);
    if (!esRol(rol)) return null;
    return { id: String(user._id), email: String(user.email || ""), nombre: String(user.nombre), walletAddress: String(user.walletAddress), rol };
  }

  async bootstrapAdmin() {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_WALLET } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_WALLET) return;
    if (ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = scryptSync(ADMIN_PASSWORD, passwordSalt, 64).toString("hex");
    await this.repository.crearAdministradorInicial({ email: ADMIN_EMAIL, passwordSalt, passwordHash, nombre: ADMIN_NAME || "Administrador AvoChain", walletAddress: ADMIN_WALLET });
  }

  private passwordValido(password: string, salt: string, hash: string): boolean {
    const actual = scryptSync(password, salt, 64);
    const esperado = Buffer.from(hash, "hex");
    return actual.length === esperado.length && timingSafeEqual(actual, esperado);
  }
  private emitirToken(user: AuthUser): string {
    if (!this.secret) throw new Error("Configura AUTH_TOKEN_SECRET en el archivo .env.");
    const payload = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, nombre: user.nombre, walletAddress: user.walletAddress, rol: user.rol, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
    return `${payload}.${this.firmar(payload)}`;
  }
  private firmar(value: string): string { return createHmac("sha256", this.secret).update(value).digest("base64url"); }
}
