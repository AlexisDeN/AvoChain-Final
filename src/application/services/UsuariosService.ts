import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { ActualizarUsuario, CrearUsuario, Usuario } from "../../domain/entities/Usuario";
import { esRolAsignable, normalizarRol } from "../../domain/access/Rol";
import { AvoChainMongoRepository } from "../../infrastructure/database/AvoChainMongoRepository";

export class UsuariosService {
  constructor(private readonly repository: AvoChainMongoRepository) {}

  async registrar(input: CrearUsuario): Promise<Usuario> {
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const nombre = String(input.nombre || "").trim();
    const walletAddress = String(input.walletAddress || "").trim() || `USR-${randomUUID()}`;
    const rol = normalizarRol(input.rol);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || !nombre || !esRolAsignable(rol)) {
      throw new Error("Completa nombre, correo válido y rol; la contraseña debe tener al menos 10 caracteres.");
    }
    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = scryptSync(password, passwordSalt, 64).toString("hex");
    const doc = await this.repository.crearCuentaUsuario({ email, passwordSalt, passwordHash, nombre, walletAddress, rol });
    return this.mapear(doc);
  }

  async actualizar(id: string, input: ActualizarUsuario): Promise<Usuario> {
    const changes: { email?: string; nombre?: string; rol?: string; estadoActivo?: boolean; passwordSalt?: string; passwordHash?: string } = {};
    if (input.email !== undefined) {
      const email = String(input.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo válido.");
      changes.email = email;
    }
    if (input.nombre !== undefined) {
      const nombre = String(input.nombre).trim();
      if (!nombre || nombre.length > 100) throw new Error("El nombre es obligatorio y debe tener máximo 100 caracteres.");
      changes.nombre = nombre;
    }
    if (input.rol !== undefined) {
      const rol = normalizarRol(input.rol);
      if (!esRolAsignable(rol)) throw new Error("El rol seleccionado no es válido.");
      changes.rol = rol;
    }
    if (input.estadoActivo !== undefined) changes.estadoActivo = input.estadoActivo === true || input.estadoActivo === "true";
    if (input.password !== undefined && String(input.password)) {
      const password = String(input.password);
      if (password.length < 10) throw new Error("La nueva contraseña debe tener al menos 10 caracteres.");
      changes.passwordSalt = randomBytes(16).toString("hex");
      changes.passwordHash = scryptSync(password, changes.passwordSalt, 64).toString("hex");
    }
    if (!Object.keys(changes).length) throw new Error("No hay cambios para guardar.");
    const user = await this.repository.actualizarUsuario(id, changes);
    if (!user) throw new Error("No se encontró el usuario.");
    return this.mapear(user);
  }

  async listar(): Promise<Usuario[]> {
    return (await this.repository.listarUsuarios()).map((user) => this.mapear(user));
  }

  async listarPorRol(rolValue: unknown): Promise<Usuario[]> {
    const rol = normalizarRol(rolValue);
    if (!esRolAsignable(rol)) throw new Error("Rol inválido.");
    return (await this.repository.buscarUsuariosPorRol(rol)).map((user) => this.mapear(user));
  }

  private mapear(user: Record<string, unknown>): Usuario {
    const rol = normalizarRol(user.rol);
    if (!esRolAsignable(rol) && rol !== "Administrador") throw new Error("El usuario tiene un rol inválido en la base de datos.");
    return {
      id: String(user._id), email: String(user.email || ""), nombre: String(user.nombre || ""),
      walletAddress: String(user.walletAddress || ""), rol: rol as Usuario["rol"],
      estadoActivo: user.estadoActivo === true,
      ...(user.fechaRegistro ? { fechaRegistro: user.fechaRegistro as Date } : {})
    };
  }
}
