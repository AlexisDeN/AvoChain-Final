// src/presentation/controllers/AvoChainFacadeController.ts
import { Request, Response } from "express";
import { AvoChainService } from "../../application/AvoChainService"; // Ruta corregida
import { AuthRequest } from "../middleware/auth";

export class AvoChainFacadeController {
  private service: AvoChainService;

  constructor(service: AvoChainService) {
    this.service = service;
  }

  registrarFinca = async (req: AuthRequest, res: Response) => this.handle(res, () => this.service.registrarFinca(req.body), 201);

  solicitarFinca = async (req: AuthRequest, res: Response) => this.handle(res, () => this.service.solicitarFincaProductor({ ...req.body, wallet: req.user?.walletAddress }), 201);

  aprobarFinca = async (req: Request, res: Response) => this.handle(res, () => this.service.aprobarFinca(this.param(req, "idFinca")));

  actualizarFinca = async (req: Request, res: Response) => this.handle(res, () => this.service.actualizarFinca(this.param(req, "idFinca"), req.body));

  registrarLote = async (req: AuthRequest, res: Response) => this.handle(res, () => this.service.registrarLote({ ...req.body, rol: req.user?.rol, wallet: req.user?.walletAddress }), 201);

  listarLotes = async (req: AuthRequest, res: Response) => this.handle(res, () => this.service.listarLotes(req.user));

  listarFincas = async (req: AuthRequest, res: Response) => this.handle(res, () => req.user?.rol === "Productor" ? this.service.listarFincasProductor(req.user.walletAddress) : this.service.listarFincas());

  actualizarLote = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.actualizarLote(this.param(req, "idLote"), req.body));

  eliminarLote = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.eliminarLote(this.param(req, "idLote"), String(req.query.rol || req.body?.rol || "")));

  agregarEvidencias = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.agregarEvidencias(this.param(req, "idLote"), req.body.fotos || []));

  asignarConductor = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.asignarConductor(this.param(req, "idLote"), { ...req.body, rol: req.user?.rol }));

  inspeccionarCalidad = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.inspeccionarCalidad(this.param(req, "idLote"), { ...req.body, rol: req.user?.rol, inspectorId: req.user?.walletAddress }));

  confirmarRecepcionDestino = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.confirmarRecepcionDestino(this.param(req, "idLote"), { ...req.body, rol: req.user?.rol, receptorId: req.user?.walletAddress }));

  generarQR = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.generarQR(this.param(req, "idLote"), Boolean(req.body?.autorizarReimpresion)));

  registrarLecturaQR = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.registrarLecturaQR(this.param(req, "idLote"), req.user!.walletAddress, req.body?.simulada === true));

  escanearRecepcion = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.recibirEnPuntoVenta(this.param(req, "idLote"), { ...req.body, usuarioId: req.user?.walletAddress }));

  venderLote = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.venderLote(this.param(req, "idLote"), { ...req.body, rol: req.user?.rol, vendedorId: req.user?.walletAddress }));

  reportarIncidente = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.reportarIncidente(this.param(req, "idLote"), { ...req.body, conductorId: req.user?.walletAddress }), 201);

  registrarPuntoControl = async (req: AuthRequest, res: Response) =>
    this.handle(res, () => this.service.registrarPuntoControl(this.param(req, "idLote"), { ...req.body, conductorId: req.user!.walletAddress }), 201);

  consultarOrigenProducto = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.consultarOrigen(this.param(req, "idLote")));

  obtenerEstadisticasLecturaRapida = async (_req: Request, res: Response) =>
    this.handle(res, () => this.service.obtenerDashboard());

  obtenerDetalleLoteAdmin = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.obtenerDetalleLoteAdmin(this.param(req, "idLote")));

  private async handle<T>(res: Response, action: () => T | Promise<T>, successStatus = 200) {
    try {
      const data = await action();
      return res.status(successStatus).json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      const status = message.includes("Falso") || message.includes("No Registrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  }

  private param(req: Request, name: string): string {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
