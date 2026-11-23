# Diagramas de clases y componentes de AvoChain

Los diagramas describen la implementación actual del proyecto. Puedes visualizarlos en un editor compatible con Mermaid, como Markdown Preview de VS Code o Mermaid Live.

## Diagrama de clases

```mermaid
classDiagram
    direction LR

    class AvoChainFacadeController {
      -AvoChainService service
      +registrarLote(req,res)
      +listarLotes(req,res)
      +inspeccionarCalidad(req,res)
      +confirmarRecepcionDestino(req,res)
      +asignarConductor(req,res)
      +reportarIncidente(req,res)
      +consultarOrigenProducto(req,res)
    }

    class AuthController {
      -AuthService auth
      +login(req,res)
      +me(req,res)
    }

    class UsersController {
      -UsuariosService users
      +crear(req,res)
      +actualizar(req,res)
      +listar(req,res)
      +listarPorRol(req,res)
    }

    class PaymentsController {
      -WompiPaymentService payments
      -PremiumService premium
      +crearCheckout(req,res)
      +confirmarPagoDemo(req,res)
      +estado(req,res)
      +webhook(req,res)
      +reportes(req,res)
    }

    class AvoChainService {
      -AvoChainMongoRepository repository
      -BlockchainAdapter blockchain
      -OfflineScanProxy offlineProxy
      -StorageProvider storage
      -QRGeneratorSingleton qrGenerator
      +listarLotes(usuario)
      +registrarLote(dto)
      +inspeccionarCalidad(id,dto)
      +confirmarRecepcionDestino(id,dto)
      +asignarConductor(id,dto)
      +reportarIncidente(id,dto)
      +consultarOrigen(id)
      +venderLote(id,dto)
    }

    class AuthService {
      -AvoChainMongoRepository repository
      +iniciarSesion(email,password)
      +verificarToken(token)
      +bootstrapAdmin()
    }

    class UsuariosService {
      -AvoChainMongoRepository repository
      +registrar(input) Usuario
      +actualizar(id,input) Usuario
      +listar() Usuario[]
      +listarPorRol(rol) Usuario[]
    }

    class Usuario {
      +id
      +email
      +nombre
      +walletAddress
      +rol Rol
      +estadoActivo
      +fechaRegistro
    }

    class Rol {
      <<enumeration>>
      Administrador
      Productor
      Inspector de calidad
      Bodeguero
      Transportador
      Receptor
      Vendedor
    }

    class PremiumService {
      -AvoChainMongoRepository repository
      +reportes(email)
      +dashboard(email)
      +historialCsv(email,idLote)
    }

    class WompiPaymentService {
      -AvoChainMongoRepository repository
      +crearCheckout(email)
      +confirmarPagoDemo(email)
      +estadoPremium(email)
      +procesarEvento(event)
      +verificarRetorno(transactionId)
    }

    class AvoChainMongoRepository {
      -MongoClient client
      -Collection usuarios
      -Collection fincas
      -Collection lotes
      -Collection pagos
      -Collection premium
      +conectar()
      +guardarLote(lote)
      +buscarLote(id)
      +listarLotes(filtro)
      +guardarFinca(finca)
      +listarFincas()
      +crearCuentaUsuario(input)
    }

    class Lote {
      +id
      +pesoKg
      +variedad
      +fechaCosecha
      +fincaId
      +estado
      +productorWallet
      +conductorId
      +rutaDespacho RutaDespacho
      +inspeccionCalidad
      +recepcionDestino
      +evidencias[]
      +incidentes[]
      +puntosControlRuta[]
      +eventos[]
    }

    class RutaDespacho {
      +origenMunicipio
      +destinoMunicipio
      +destinoDetalle
      +asignadaEn
    }

    class Finca {
      +id
      +nombre
      +registroICA
      +gps
      +certificadoPdfUrl
      +activa
      +productorWallet
    }

    class FincaBuilder {
      -Finca finca
      +setId(id)
      +setNombre(nombre)
      +setICA(ica)
      +setGPS(gps)
      +setCertificado(url)
      +build() Finca
    }

    class LoteContext {
      -LoteState estado
      +despachar()
      +recibirEnPuntoVenta()
      +vender()
      +getEstadoNombre()
    }

    class LoteState {
      <<interface>>
      +nombreEstado
      +despachar(context)
      +recibirEnPuntoVenta(context)
      +vender(context)
    }
    class EstadoRegistrado
    class EstadoAprobadoCalidad
    class EstadoRechazadoOrigen
    class EstadoEnTransito
    class EstadoEnPuntoVenta
    class EstadoVendido

    class QualityStrategy {
      <<interface>>
      +evaluar(mediciones) boolean
    }
    class ExportQualityStrategy {
      +evaluar(mediciones) boolean
    }
    class NationalQualityStrategy {
      +evaluar(mediciones) boolean
    }

    class ReceptionValidationChain {
      -checks[]
      +validar(estado,dto)
    }

    class IBlockchainAdapter {
      <<interface>>
      +registrarLoteBlockchain(id,peso,finca) string
      +despacharLote(id,conductor) string
      +recibirEnPuntoVenta(id,usuario) string
      +quemarQrVendido(id,vendedor) string
      +registrarEvento(id,tipo) string
    }
    class BlockchainAdapter {
      +registrarLoteBlockchain(id,peso,finca) string
      +despacharLote(id,conductor) string
      +recibirEnPuntoVenta(id,usuario) string
      +quemarQrVendido(id,vendedor) string
      +registrarEvento(id,tipo) string
    }
    class OfflineScanProxy {
      -IBlockchainAdapter blockchainAdapter
      -colaLocales[]
      +escanearQR(id,usuario,isOnline)
    }
    class QRGeneratorSingleton {
      -QRGeneratorSingleton instance
      +getInstance()
      +generarQRBase64(idLote)
    }
    class StorageProvider {
      <<interface>>
      +uploadImage(buffer,filename) string
    }
    class StorageFactory {
      +getProvider(type) StorageProvider
    }
    class IPFSStorageProvider {
      +uploadImage(buffer,filename) string
    }

    AvoChainFacadeController --> AvoChainService
    AuthController --> AuthService
    UsersController --> UsuariosService
    PaymentsController --> WompiPaymentService
    PaymentsController --> PremiumService
    AuthService --> AvoChainMongoRepository
    UsuariosService --> AvoChainMongoRepository
    WompiPaymentService --> AvoChainMongoRepository
    PremiumService --> AvoChainMongoRepository
    AvoChainService --> AvoChainMongoRepository
    AvoChainService --> BlockchainAdapter
    AvoChainService --> OfflineScanProxy
    AvoChainService --> QRGeneratorSingleton
    AvoChainService --> StorageProvider
    AvoChainService ..> QualityStrategy : selecciona según destino
    AvoChainService ..> ReceptionValidationChain : valida recepción
    AvoChainService ..> LoteContext : aplica transiciones
    FincaBuilder --> Finca : construye
    LoteContext o--> LoteState : estado actual
    LoteState <|.. EstadoRegistrado
    LoteState <|.. EstadoAprobadoCalidad
    LoteState <|.. EstadoRechazadoOrigen
    LoteState <|.. EstadoEnTransito
    LoteState <|.. EstadoEnPuntoVenta
    LoteState <|.. EstadoVendido
    QualityStrategy <|.. ExportQualityStrategy
    QualityStrategy <|.. NationalQualityStrategy
    IBlockchainAdapter <|.. BlockchainAdapter
    OfflineScanProxy --> IBlockchainAdapter
    StorageProvider <|.. IPFSStorageProvider
    StorageFactory ..> IPFSStorageProvider : crea
    Lote "*" --> "1" Finca : fincaId
    Lote "1" --> "0..1" RutaDespacho : rutaDespacho
    Usuario --> Rol
```

## Diagrama de componentes

```mermaid
flowchart LR
    actor[Usuarios por rol<br/>Administrador · Productor · Calidad<br/>Bodega · Transportador · Receptor · Vendedor]
    browser[Interfaz web responsive<br/>public/index.html]
    api[API REST<br/>Express · src/app.ts]
    auth[Middleware de autenticación<br/>JWT · permisos por rol · propiedad del lote]
    controllers[Controladores<br/>AvoChainFacadeController<br/>AuthController · UsersController<br/>PaymentsController]
    services[Servicios de aplicación<br/>AvoChainService · AuthService<br/>UsuariosService · PremiumService<br/>WompiPaymentService]
    domain[Dominio<br/>Usuario · Rol · Lote · Finca<br/>estados · Strategy de calidad<br/>Chain de validación de recepción]
    mongoRepo[Repositorio MongoDB<br/>AvoChainMongoRepository]
    mongo[(MongoDB<br/>usuarios · fincas · lotes<br/>pagosWompi · accesosPremium)]
    qr[Generador QR<br/>QRCode · singleton]
    blockchain[Adaptador blockchain<br/>BlockchainAdapter<br/>simulado en esta versión]
    storage[Almacenamiento de evidencias<br/>StorageFactory · proveedor IPFS<br/>simulado en esta versión]
    wompi[Pasarela Wompi<br/>checkout · retorno · webhook<br/>y pago de demostración]

    actor --> browser
    browser <-->|HTTP JSON + JWT| api
    api --> auth
    auth --> controllers
    controllers --> services
    services --> domain
    services --> mongoRepo
    mongoRepo <-->|CRUD| mongo
    services --> qr
    services --> blockchain
    services --> storage
    services --> wompi
    wompi --> mongoRepo

    classDef external fill:#f5f5f5,stroke:#64748b,color:#111827;
    class actor,browser,mongo,wompi external;
```

### Nota de implementación

La persistencia principal se realiza en MongoDB. En el estado actual del código, el adaptador de blockchain genera hashes simulados y el proveedor de almacenamiento devuelve enlaces de ejemplo tipo IPFS; no son todavía integraciones con una blockchain ni con un servicio IPFS/S3 real.
