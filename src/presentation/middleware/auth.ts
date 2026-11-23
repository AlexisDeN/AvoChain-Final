import { NextFunction, Request, Response } from "express";
import { AuthService, AuthUser } from "../../application/services/AuthService";

export type AuthRequest = Request & { user?: AuthUser };
export const autenticar = (auth: AuthService) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  const tokenUser = auth.verificarToken(token);
  if (!tokenUser) return res.status(401).json({ error: "Inicia sesión para continuar." });
  try {
    const user = await auth.cargarSesionVigente(tokenUser.id);
    if (!user) return res.status(401).json({ error: "La cuenta está inactiva o ya no existe. Inicia sesión de nuevo." });
    req.user = user;
    return next();
  } catch { return res.status(500).json({ error: "No se pudo validar tu sesión." }); }
};

export const permitirRoles = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.rol)) return res.status(403).json({ error: "Tu rol no tiene permiso para esta operación." });
  return next();
};

export const requerirPremium = (repository: { tienePremium(email: string): Promise<boolean> }) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !(await repository.tienePremium(req.user.email))) return res.status(403).json({ error: "Esta función requiere Premium para la cuenta autenticada." });
    return next();
  } catch { return res.status(500).json({ error: "No se pudo validar la suscripción." }); }
};
