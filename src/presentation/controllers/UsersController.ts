import { Request, Response } from "express";
import { UsuariosService } from "../../application/services/UsuariosService";
import { AuthRequest } from "../middleware/auth";

export class UsersController {
  constructor(private readonly users: UsuariosService) {}

  crear = async (req: Request, res: Response) => {
    try { return res.status(201).json(await this.users.registrar(req.body || {})); }
    catch (error) { return this.error(res, error, 400); }
  };

  actualizar = async (req: Request, res: Response) => {
    try { return res.json(await this.users.actualizar(String(req.params.idUsuario), req.body || {})); }
    catch (error) { return this.error(res, error, 400); }
  };

  listar = async (_req: Request, res: Response) => {
    try { return res.json(await this.users.listar()); }
    catch (error) { return this.error(res, error, 500); }
  };

  listarPorRol = async (req: AuthRequest, res: Response) => {
    const rol = String(req.params.rol || "");
    if (req.user?.rol === "Bodeguero" && rol !== "Transportador") {
      return res.status(403).json({ error: "Bodega solo puede consultar conductores activos para asignar el despacho." });
    }
    try {
      const users = await this.users.listarPorRol(rol);
      return res.json(users.map(({ nombre, walletAddress, rol: role }) => ({ nombre, walletAddress, rol: role })));
    } catch (error) { return this.error(res, error, 400); }
  };

  private error(res: Response, error: unknown, fallbackStatus: number) {
    const message = error instanceof Error ? error.message : "No se pudo completar la operación de usuarios.";
    return res.status(message.includes("ya pertenece") || message.includes("ya está asociado") ? 409 : fallbackStatus).json({ error: message });
  }
}
