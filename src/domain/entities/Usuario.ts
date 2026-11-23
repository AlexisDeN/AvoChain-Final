import { Rol } from "../access/Rol";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  walletAddress: string;
  rol: Rol;
  estadoActivo: boolean;
  fechaRegistro?: string | Date;
}

export type UsuarioSesion = Pick<Usuario, "id" | "email" | "nombre" | "walletAddress" | "rol">;

export interface CrearUsuario {
  email: unknown;
  password: unknown;
  nombre: unknown;
  walletAddress: unknown;
  rol: unknown;
}

export interface ActualizarUsuario {
  email?: unknown;
  nombre?: unknown;
  rol?: unknown;
  estadoActivo?: unknown;
  password?: unknown;
}
