import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { AvoChainFacadeController } from "./presentation/controllers/AvoChainFacadeController";
import { PaymentsController } from "./presentation/controllers/PaymentsController";
import { AvoChainService } from "./application/AvoChainService";
import { PremiumService } from "./application/services/PremiumService";
import { WompiPaymentService } from "./application/services/WompiPaymentService";
import { AvoChainMongoRepository } from "./infrastructure/database/AvoChainMongoRepository";
import { AuthController } from "./presentation/controllers/AuthController";
import { UsersController } from "./presentation/controllers/UsersController";
import { AuthService } from "./application/services/AuthService";
import { UsuariosService } from "./application/services/UsuariosService";
import { VinculacionService } from "./application/services/VinculacionService";
import { VinculacionController } from "./presentation/controllers/VinculacionController";
import { SmtpMailer } from "./infrastructure/email/SmtpMailer";
import { autenticar, permitirRoles, requerirPremium, AuthRequest } from "./presentation/middleware/auth";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const repository = new AvoChainMongoRepository();
const service = new AvoChainService(repository);
const facadeController = new AvoChainFacadeController(service);
const paymentsController = new PaymentsController(
  new WompiPaymentService(repository),
  new PremiumService(repository)
);
const auth = new AuthService(repository);
const authController = new AuthController(auth);
const usersController = new UsersController(new UsuariosService(repository));
const vinculacionController = new VinculacionController(new VinculacionService(repository, new SmtpMailer()));
const requiereSesion = autenticar(auth);
const soloPremium = requerirPremium(repository);
const accesoPropioLote = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const user = req.user!;
    const lote = await repository.buscarLote(String(req.params.idLote || ""));
    if (!lote) return res.status(404).json({ error: "Lote no encontrado." });
    const esPropietario = user.rol === "Productor" && lote.productorWallet === user.walletAddress;
    const esConductorAsignado = user.rol === "Transportador" && lote.conductorId === user.walletAddress;
    const estadoPermitido = (user.rol === "Inspector de calidad" && lote.estado === "Registrado")
      || (user.rol === "Receptor" && lote.estado === "En Transito")
      || (user.rol === "Vendedor" && lote.estado === "En Punto de Venta")
      || (user.rol === "Bodeguero" && lote.estado === "Aprobado_Calidad");
    if (!esPropietario && !esConductorAsignado && !estadoPermitido) return res.status(403).json({ error: "Este lote no está asignado a tu cuenta o no corresponde a tu etapa." });
    return next();
  } catch { return res.status(500).json({ error: "No se pudo validar la asignación del lote." }); }
};

app.get("/health", (_req, res) => res.json({ status: "ok", service: "AvoChain" }));
app.post("/api/v1/pagos/wompi/webhook", paymentsController.webhook);
app.post("/api/v1/auth/login", authController.login);
app.post("/api/v1/auth/activar-cuenta", authController.activarCuenta);
app.post("/api/v1/vinculaciones", vinculacionController.solicitar);
app.use("/api/v1", requiereSesion);
app.get("/api/v1/auth/me", authController.me);
app.post("/api/v1/pagos/wompi/checkout", permitirRoles("Productor"), paymentsController.crearCheckout);
app.post("/api/v1/pagos/demo/confirmar", permitirRoles("Productor"), paymentsController.confirmarPagoDemo);
app.post("/api/v1/pagos/wompi/verificar", paymentsController.verificarRetorno);
app.get("/api/v1/pagos/wompi/estado", paymentsController.estado);
app.get("/api/v1/premium/reportes", permitirRoles("Administrador"), paymentsController.reportes);
app.get("/api/v1/premium/lotes/:idLote/historial.csv", permitirRoles("Administrador"), paymentsController.exportarHistorial);
app.get("/api/v1/usuarios", permitirRoles("Administrador"), usersController.listar);
app.get("/api/v1/usuarios/rol/:rol", permitirRoles("Administrador", "Bodeguero"), usersController.listarPorRol);
app.patch("/api/v1/usuarios/:idUsuario", permitirRoles("Administrador"), usersController.actualizar);
app.patch("/api/v1/admin/fincas/:idFinca/aprobar", permitirRoles("Administrador"), facadeController.aprobarFinca);
app.get("/api/v1/admin/vinculaciones", permitirRoles("Administrador"), vinculacionController.listar);
app.get("/api/v1/admin/vinculaciones/:id/documentos/:indice", permitirRoles("Administrador"), vinculacionController.documento);
app.post("/api/v1/admin/vinculaciones/:id/aprobar", permitirRoles("Administrador"), vinculacionController.aprobar);
app.post("/api/v1/admin/vinculaciones/:id/rechazar", permitirRoles("Administrador"), vinculacionController.rechazar);
app.post("/api/v1/fincas", permitirRoles("Administrador"), facadeController.registrarFinca);
app.post("/api/v1/fincas/solicitar", permitirRoles("Productor"), facadeController.solicitarFinca);
app.patch("/api/v1/fincas/:idFinca", permitirRoles("Administrador"), facadeController.actualizarFinca);
app.get("/api/v1/fincas", permitirRoles("Administrador", "Productor"), facadeController.listarFincas);
app.get("/api/v1/lotes", permitirRoles("Administrador", "Productor", "Transportador", "Inspector de calidad", "Bodeguero", "Receptor", "Vendedor"), facadeController.listarLotes);
app.get("/api/v1/productor/lotes/:idLote", permitirRoles("Productor"), accesoPropioLote, soloPremium, facadeController.obtenerDetalleLoteAdmin);
app.post("/api/v1/lotes", permitirRoles("Productor"), facadeController.registrarLote);
app.patch("/api/v1/lotes/:idLote", permitirRoles("Administrador"), facadeController.actualizarLote);
app.delete("/api/v1/lotes/:idLote", permitirRoles("Administrador"), facadeController.eliminarLote);
app.post("/api/v1/lotes/:idLote/evidencias", permitirRoles("Productor"), accesoPropioLote, facadeController.agregarEvidencias);
app.post("/api/v1/lotes/:idLote/qr", permitirRoles("Bodeguero"), accesoPropioLote, facadeController.generarQR);
app.post("/api/v1/lotes/:idLote/qr/lectura", permitirRoles("Transportador"), accesoPropioLote, facadeController.registrarLecturaQR);
app.post("/api/v1/lotes/:idLote/despacho", permitirRoles("Bodeguero"), accesoPropioLote, facadeController.asignarConductor);
app.post("/api/v1/lotes/:idLote/inspeccion-calidad", permitirRoles("Inspector de calidad"), accesoPropioLote, facadeController.inspeccionarCalidad);
app.post("/api/v1/lotes/:idLote/recepcion-destino", permitirRoles("Receptor"), accesoPropioLote, facadeController.confirmarRecepcionDestino);
app.post("/api/v1/lotes/:idLote/recepcion", permitirRoles("Receptor"), accesoPropioLote, facadeController.escanearRecepcion);
app.post("/api/v1/lotes/:idLote/incidentes", permitirRoles("Transportador"), accesoPropioLote, facadeController.reportarIncidente);
app.post("/api/v1/lotes/:idLote/ruta/puntos", permitirRoles("Transportador"), accesoPropioLote, facadeController.registrarPuntoControl);
app.post("/api/v1/lotes/:idLote/venta", permitirRoles("Vendedor"), accesoPropioLote, facadeController.venderLote);
app.get("/api/v1/producto/origen/:idLote", facadeController.consultarOrigenProducto);
app.get("/api/v1/admin/dashboard", permitirRoles("Administrador"), paymentsController.dashboardPremium);
app.get("/api/v1/admin/lotes/:idLote", permitirRoles("Administrador"), facadeController.obtenerDetalleLoteAdmin);

const PORT = process.env.PORT || 3001;
async function start(): Promise<void> {
  await repository.conectar();
  await auth.bootstrapAdmin();
  app.listen(PORT, () => console.log(`Backend AvoChain conectado a MongoDB en http://localhost:${PORT}`));
}

start().catch((error) => {
  console.error("No fue posible conectar con MongoDB:", error);
  process.exit(1);
});
