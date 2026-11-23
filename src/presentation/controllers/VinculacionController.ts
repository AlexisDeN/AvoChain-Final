import { Request, Response } from "express";
import { VinculacionService } from "../../application/services/VinculacionService";
import { AuthRequest } from "../middleware/auth";

export class VinculacionController {
  constructor(private service: VinculacionService) {}
  solicitar = async (req: Request, res: Response) => { try { return res.status(201).json(await this.service.solicitar(req.body || {})); } catch (e) { return this.fail(res, e); } };
  listar = async (_req: AuthRequest, res: Response) => { try { return res.json(await this.service.listar()); } catch (e) { return this.fail(res, e, 500); } };
  aprobar = async (req: AuthRequest, res: Response) => { try { return res.json(await this.service.aprobar(String(req.params.id), req.user!.email)); } catch (e) { return this.fail(res, e); } };
  rechazar = async (req: AuthRequest, res: Response) => { try { return res.json(await this.service.rechazar(String(req.params.id), req.user!.email, String(req.body?.motivo || ""))); } catch (e) { return this.fail(res, e); } };
  documento = async (req: AuthRequest, res: Response) => {
    try {
      const doc = await this.service.documento(String(req.params.id), Number(req.params.indice));
      if (!doc) return res.status(404).json({ error: "No se encontró el documento." });
      const bytes = doc.contenido as Buffer;
      res.setHeader("Content-Type", String(doc.mimeType));
      res.setHeader("Content-Disposition", `attachment; filename="${String(doc.nombreArchivo).replace(/[\r\n"\\]/g, "_")}"`);
      return res.send(bytes);
    } catch (e) { return this.fail(res, e, 500); }
  };
  private fail(res: Response, error: unknown, fallback = 400) { return res.status(fallback).json({ error: error instanceof Error ? error.message : "No se pudo completar la solicitud." }); }
}
