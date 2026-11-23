import { Request, Response } from "express";
import { AuthService } from "../../application/services/AuthService";
import { AuthRequest } from "../middleware/auth";

export class AuthController {
  constructor(private auth: AuthService) {}
  login = async (req: Request, res: Response) => {
    try { return res.json(await this.auth.iniciarSesion(req.body?.email, req.body?.password)); }
    catch (error) { return res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo iniciar sesión." }); }
  };
  activarCuenta = async (req: Request, res: Response) => {
    try { return res.json(await this.auth.activarCuenta(req.body?.token, req.body?.password)); }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo activar la cuenta." }); }
  };
  me = (req: AuthRequest, res: Response) => res.json(req.user);
}
