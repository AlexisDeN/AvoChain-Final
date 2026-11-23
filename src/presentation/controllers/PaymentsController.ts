import { Request, Response } from "express";
import { PremiumService } from "../../application/services/PremiumService";
import { WompiPaymentService } from "../../application/services/WompiPaymentService";
import { AuthRequest } from "../middleware/auth";

export class PaymentsController {
  constructor(private readonly payments: WompiPaymentService, private readonly premium: PremiumService) {}

  crearCheckout = async (req: AuthRequest, res: Response) => {
    try { return res.status(201).json(await this.payments.crearCheckout(req.user?.email)); }
    catch (error) { return this.error(res, error); }
  };

  confirmarPagoDemo = async (req: AuthRequest, res: Response) => {
    try { return res.status(201).json(await this.payments.confirmarPagoDemo(req.user?.email, req.body?.metodo)); }
    catch (error) { return this.error(res, error); }
  };

  estado = async (req: AuthRequest, res: Response) => {
    try { return res.json(await this.payments.estadoPremium(req.user?.email)); }
    catch (error) { return this.error(res, error); }
  };

  verificarRetorno = async (req: Request, res: Response) => {
    try { return res.json(await this.payments.verificarRetorno(req.body?.transactionId)); }
    catch (error) { return this.error(res, error); }
  };

  webhook = async (req: Request, res: Response) => {
    try { await this.payments.procesarEvento(req.body); return res.sendStatus(200); }
    catch (error) { return this.error(res, error); }
  };

  reportes = async (req: AuthRequest, res: Response) => {
    try { return res.json(await this.premium.reportes(req.user?.email || "")); }
    catch (error) { return this.error(res, error); }
  };

  dashboardPremium = async (req: AuthRequest, res: Response) => {
    try { return res.json(await this.premium.dashboard(req.user?.email || "")); }
    catch (error) { return this.error(res, error); }
  };

  exportarHistorial = async (req: AuthRequest, res: Response) => {
    try {
      const csv = await this.premium.historialCsv(req.user?.email || "", this.param(req, "idLote"));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="historial-${this.param(req, "idLote")}.csv"`);
      return res.send(csv);
    } catch (error) { return this.error(res, error); }
  };

  private error(res: Response, error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    const status = message.includes("no existe") || message.includes("No Registrado")
      ? 404
      : message.includes("requiere el plan Premium") || message.includes("requiere Premium") ? 403 : 400;
    return res.status(status).json({ error: message });
  }

  private param(req: Request, name: string): string {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
