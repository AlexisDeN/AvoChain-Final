workspace "AvoChain - Modelo C4" "Arquitectura actual de la aplicación web de trazabilidad de lotes de aguacate." {

  model {
    admin = person "Administrador" "Aprueba vinculaciones, administra usuarios y fincas, y consulta la trazabilidad global."
    producer = person "Productor" "Solicita fincas y registra lotes asociados a sus fincas aprobadas."
    inspector = person "Inspector de calidad" "Evalúa y aprueba o rechaza la calidad de lotes registrados."
    warehouse = person "Bodeguero" "Genera QR y despacha lotes asignando un transportador."
    driver = person "Transportador" "Consulta lotes asignados y registra ruta, puntos de control e incidentes."
    receiver = person "Receptor" "Confirma la recepción del lote en destino."
    seller = person "Vendedor" "Registra la venta del lote recibido."

    wompi = softwareSystem "Wompi" "Pasarela externa para checkout y notificaciones de pago, cuando se configura." {
      tags "External"
    }
    smtp = softwareSystem "Proveedor SMTP" "Servicio externo para enviar enlaces de activación de cuentas." {
      tags "External"
    }

    avochain = softwareSystem "AvoChain" "Aplicación web para gestionar usuarios y la trazabilidad del aguacate desde el registro hasta la venta." {
      web = container "Interfaz web adaptable" "Interfaz HTML, CSS y JavaScript servida por Express; presenta módulos según el rol." "Navegador web · public/index.html"
      api = container "Servidor web y API REST" "Sirve la interfaz y aplica autenticación, permisos, reglas de negocio y casos de uso." "Node.js · Express · TypeScript" {
        routes = component "Rutas REST y servidor estático" "Define endpoints /api/v1 y entrega archivos de public/." "Express · src/app.ts"
        authMiddleware = component "Autenticación y autorización" "Valida JWT, sesión vigente y permisos por rol." "Middleware Express · src/presentation/middleware/auth.ts"
        facadeController = component "Controlador de trazabilidad" "Recibe operaciones de lotes, fincas, calidad, despacho, ruta, recepción y venta." "AvoChainFacadeController"
        authController = component "Controlador de sesión" "Inicia sesión, activa cuentas y consulta la sesión vigente." "AuthController"
        usersController = component "Controlador de usuarios" "Administra y consulta usuarios." "UsersController"
        linkingController = component "Controlador de vinculaciones" "Recibe solicitudes y permite revisarlas y aprobarlas." "VinculacionController"
        paymentsController = component "Controlador de pagos y Premium" "Gestiona checkout, pagos demo, webhook y reportes." "PaymentsController"
        lotService = component "Servicio de trazabilidad" "Ejecuta los casos de uso de finca y lote y coordina reglas de dominio." "AvoChainService"
        authService = component "Servicio de autenticación" "Verifica contraseñas y emite tokens JWT firmados." "AuthService"
        usersService = component "Servicio de usuarios" "Registra, edita y lista usuarios del sistema." "UsuariosService"
        linkingService = component "Servicio de vinculación" "Valida solicitudes y documentos, aprueba cuentas y genera enlaces de activación." "VinculacionService"
        paymentService = component "Servicios Wompi y Premium" "Crea/valida pagos, activa Premium y genera reportes." "WompiPaymentService · PremiumService"
        domainRules = component "Reglas de dominio" "Entidades Usuario, Finca y Lote; estados del lote, estrategia de calidad y cadena de validación de recepción." "src/domain"
        repository = component "Repositorio MongoDB" "Mapea entidades y persiste usuarios, fincas, lotes, pagos, Premium y solicitudes." "AvoChainMongoRepository"
        adapters = component "Adaptadores simulados" "Genera hashes de blockchain de demostración, QR y enlaces de almacenamiento IPFS simulados." "BlockchainAdapter · QRGeneratorSingleton · StorageFactory"
        mailer = component "Servicio de correo" "Envía enlaces de activación mediante SMTP." "SmtpMailer"
      }
      database = container "Base de datos" "Guarda usuarios, fincas, lotes y eventos embebidos, pagos, accesos Premium y solicitudes de vinculación." "MongoDB 8 · Docker"
    }

    admin -> web "Administra la plataforma" "HTTPS"
    producer -> web "Registra y consulta sus lotes" "HTTPS"
    inspector -> web "Inspecciona lotes" "HTTPS"
    warehouse -> web "Prepara y despacha lotes" "HTTPS"
    driver -> web "Actualiza ruta e incidentes" "HTTPS"
    receiver -> web "Confirma entregas" "HTTPS"
    seller -> web "Registra ventas" "HTTPS"
    web -> api "Solicita la interfaz y consume la API con JSON y JWT" "HTTP/HTTPS"
    web -> routes "Envía solicitudes JSON de la interfaz a las rutas REST" "HTTP/HTTPS"
    api -> database "Lee y escribe documentos" "MongoDB driver · puerto local 27018"
    api -> wompi "Checkout y notificaciones de pago si las credenciales están configuradas" "HTTPS"
    api -> smtp "Envío de activaciones si SMTP está configurado" "SMTP"
    avochain -> wompi "Ofrece checkout y procesa pagos cuando se configura" "HTTPS"
    avochain -> smtp "Envía enlaces de activación cuando se configura" "SMTP"
    paymentService -> wompi "Inicia checkout y procesa retorno/webhook si está configurado" "HTTPS"
    linkingService -> smtp "Envía enlace de activación" "SMTP · si está configurado"

    routes -> authMiddleware "Protege rutas privadas"
    routes -> facadeController "Enruta operaciones de trazabilidad"
    routes -> authController "Enruta inicio de sesión y sesión vigente"
    routes -> usersController "Enruta administración de usuarios"
    routes -> linkingController "Enruta solicitudes de vinculación"
    routes -> paymentsController "Enruta pagos y funciones Premium"
    authMiddleware -> authService "Valida el token y carga la cuenta"
    facadeController -> lotService "Ejecuta casos de uso de trazabilidad"
    authController -> authService "Autentica y administra sesión"
    usersController -> usersService "Ejecuta operaciones de usuarios"
    linkingController -> linkingService "Gestiona solicitudes y aprobación"
    paymentsController -> paymentService "Procesa pagos y reportes Premium"
    lotService -> domainRules "Aplica reglas y transiciones del dominio"
    lotService -> repository "Consulta y persiste datos"
    lotService -> adapters "Solicita QR, hashes y almacenamiento de evidencia simulado"
    authService -> repository "Consulta cuentas y estado de usuario"
    usersService -> repository "Lee y actualiza usuarios"
    linkingService -> repository "Persiste solicitudes y cuentas aprobadas"
    linkingService -> mailer "Solicita envío de activación"
    paymentService -> repository "Guarda pagos y accesos Premium"
    repository -> database "CRUD de colecciones"
    development = deploymentEnvironment "Desarrollo local" {
      deploymentNode "Equipo del usuario" "Equipo Windows donde se ejecuta AvoChain durante el desarrollo." "Windows" {
        deploymentNode "Navegador web" "Ejecuta la interfaz y se comunica con el servidor por HTTP." "Chrome, Edge u otro navegador" {
          containerInstance web
        }
        deploymentNode "Servidor AvoChain" "Ejecuta npm run dev o npm start y sirve la interfaz y la API." "Node.js · Express" {
          containerInstance api
        }
        deploymentNode "Docker Engine" "Levanta el servicio MongoDB definido en docker-compose.yml." "Docker Compose" {
          deploymentNode "Contenedor MongoDB" "Servicio mongo; puerto host 27018 hacia 27017 del contenedor." "MongoDB 8" {
            containerInstance database
          }
        }
      }
      deploymentNode "Servicios externos (opcionales)" "Solo participan si se configuran las credenciales correspondientes." "Internet" {
        softwareSystemInstance wompi
        softwareSystemInstance smtp
      }
    }
  }

  views {
    systemContext avochain "C1-contexto" "AvoChain y los actores y sistemas externos que lo rodean." {
      include *
      autoLayout lr
    }

    container avochain "C2-contenedores" "Interfaz, servidor API y persistencia de AvoChain." {
      include *
      autoLayout lr
    }

    component api "C3-componentes-api" "Responsabilidades internas del servidor Node.js/Express." {
      include *
      autoLayout lr
    }

    dynamic api "D1-registro-calidad" "Registro de lote e inspección de calidad." {
      producer -> web "Registra lote en finca propia"
      web -> routes "Envía POST /lotes"
      routes -> authMiddleware "Valida sesión y rol"
      routes -> facadeController "Enruta el registro"
      facadeController -> lotService "Ejecuta el caso de uso"
      lotService -> domainRules "Valida finca y estado inicial"
      lotService -> repository "Persiste el lote"
      repository -> database "Guarda el documento"
      inspector -> web "Envía inspección de calidad"
      web -> routes "Envía POST inspeccion-calidad"
      routes -> authMiddleware "Autoriza Inspector de calidad"
      routes -> facadeController "Enruta la inspección"
      facadeController -> lotService "Evalúa las mediciones"
      lotService -> domainRules "Strategy decide aprobación o rechazo"
      lotService -> repository "Guarda informe, estado e historial"
      repository -> database "Actualiza el lote"
      autoLayout lr
    }

    dynamic api "D2-despacho-transporte" "Generación del QR, despacho y seguimiento de ruta." {
      warehouse -> web "Genera QR y prepara despacho"
      web -> routes "Envía QR y despacho"
      routes -> authMiddleware "Valida rol Bodeguero"
      routes -> facadeController "Enruta el despacho"
      facadeController -> lotService "Valida calidad y asigna conductor"
      lotService -> domainRules "Valida transición a tránsito"
      lotService -> adapters "Genera QR y hash simulado"
      lotService -> repository "Persiste el despacho"
      repository -> database "Actualiza el lote"
      driver -> web "Registra punto GPS o incidente"
      web -> routes "Envía evento de ruta"
      routes -> authMiddleware "Valida rol Transportador"
      routes -> facadeController "Enruta el evento"
      facadeController -> lotService "Valida conductor asignado"
      lotService -> domainRules "Comprueba estado En Tránsito"
      lotService -> repository "Guarda ubicación e historial"
      repository -> database "Actualiza el lote"
      autoLayout lr
    }

    dynamic api "D3-recepcion-venta" "Confirmación de entrega y registro de la venta." {
      receiver -> web "Confirma recepción"
      web -> routes "Envía POST recepcion-destino"
      routes -> authMiddleware "Valida rol Receptor"
      routes -> facadeController "Enruta la recepción"
      facadeController -> lotService "Valida temperatura y daños"
      lotService -> domainRules "Comprueba estado y rangos"
      lotService -> adapters "Registra hash simulado"
      lotService -> repository "Guarda recepción y nuevo estado"
      repository -> database "Actualiza el lote"
      seller -> web "Registra la venta"
      web -> routes "Envía POST venta"
      routes -> authMiddleware "Valida rol Vendedor"
      routes -> facadeController "Enruta la venta"
      facadeController -> lotService "Cambia estado a Vendido"
      lotService -> domainRules "Valida transición de estado"
      lotService -> adapters "Simula la quema del QR"
      lotService -> repository "Guarda venta e historial"
      repository -> database "Actualiza el lote"
      autoLayout lr
    }
    deployment avochain "Desarrollo local" "C4-despliegue" "Nodos de ejecución, instancias de contenedores y servicios externos opcionales." {
      include *
      autoLayout lr
    }

    styles {
      element "Person" {
        background #0B5394
        color #FFFFFF
        shape person
      }
      element "Software System" {
        background #1168BD
        color #FFFFFF
      }
      element "Container" {
        background #438DD5
        color #FFFFFF
      }
      element "Component" {
        background #85BBF0
        color #000000
      }
      element "External" {
        background #999999
        color #FFFFFF
      }
    }
  }
}
