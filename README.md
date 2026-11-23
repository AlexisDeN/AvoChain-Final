# AvoChain

Aplicación web adaptable para registrar la trazabilidad del aguacate. El backend TypeScript/Express persiste en MongoDB y usa un adaptador de blockchain simulado para el prototipo.

## Iniciar el proyecto

1. Copia `.env.example` como `.env` y configura credenciales privadas propias. No compartas `.env`.
2. Inicia MongoDB con `docker compose up -d mongo`.
3. Instala dependencias con `npm install`.
4. Ejecuta `npm start` y abre `http://localhost:3001`.

La primera cuenta administradora se crea al arrancar si se definen `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres) y `ADMIN_WALLET`. La contraseña se guarda con hash scrypt. El resto de usuarios solicita vinculación desde el inicio, adjunta sus soportes y espera aprobación administrativa. Al aprobar, se crea una cuenta inactiva y se envía un enlace de un solo uso para crear su contraseña (vence en 24 horas). En modo local sin SMTP, el enlace de demostración se escribe en la consola del servidor. No se envían contraseñas por correo.

`AUTH_TOKEN_SECRET` debe ser un secreto aleatorio de al menos 32 bytes. Cada inicio de sesión recibe un token firmado que vence a las 8 horas. La interfaz guarda el token solo durante la sesión actual del navegador.

## Módulos y permisos

- **Administrador:** aprueba solicitudes de acceso, administra usuarios y fincas, y consulta/edita la trazabilidad completa de todos los lotes sin una suscripción Premium.
- **Productor:** registra lotes únicamente en fincas asociadas a su cuenta. Siempre ve su lista; con Premium abre la ficha completa de solo lectura de sus lotes.
- **Inspector de calidad:** ve lotes pendientes y registra inspecciones.
- **Bodeguero:** genera QR y despacha lotes aprobados a un conductor registrado.
- **Transportador:** solo ve lotes asignados a su wallet; registra puntos de control GPS e incidentes durante el tránsito.
- **Receptor:** ve lotes en tránsito y confirma su recepción.
- **Vendedor:** ve lotes recibidos y registra la venta.

Los permisos se validan en las rutas del backend, además de ocultar las vistas que no corresponden al usuario. Las acciones guardan la wallet de la sesión como actor; no se acepta del navegador para suplantar conductor, inspector, receptor o productor.

## Flujo de trazabilidad

Administrador registra cuentas y asocia una finca a un productor → productor registra cosecha → inspector aprueba o rechaza calidad → bodega genera QR y asigna conductor → transportador registra puntos de control e incidentes → receptor confirma llegada → vendedor registra la venta. Los cambios de estado e historial se guardan en MongoDB; el hash de blockchain es simulado en esta versión.

## Estructura

```text
src/
├── domain/          # Entidades, reglas de estado y estrategias de calidad
├── application/     # Casos de uso y servicios
├── infrastructure/  # MongoDB, almacenamiento y adaptadores externos
└── presentation/    # Controladores y middleware de autenticación/roles
public/              # Interfaz web adaptable
mongo/               # Inicialización del contenedor MongoDB
```

La correspondencia de esta estructura con Modelo–Vista–Controlador (MVC), el recorrido de una solicitud y las responsabilidades de cada capa están explicadas en [docs/arquitectura-mvc.md](docs/arquitectura-mvc.md).

## Persistencia MongoDB

La base `avochain` usa `usuarios`, `fincas`, `lotes`, `pagosWompi`, `accesosPremium` y `solicitudesVinculacion`. Los documentos adjuntos se guardan temporalmente dentro de la solicitud en MongoDB, limitados a 2 MB cada uno. Los usuarios están separados de las fincas; lotes referencian finca y conservan los actores por wallet/identificador. Los puntos de control e incidentes se almacenan dentro del lote y forman parte de su historial.

### Usuarios y roles propios de MongoDB

Los roles de negocio de AvoChain (`Productor`, `Transportador`, etc.) se guardan en `usuarios` y la API los aplica con JWT y permisos por ruta. Son distintos de los usuarios y roles de seguridad que autentican conexiones directas a MongoDB.

La aplicación usa `MONGODB_URI`, que debe corresponder a `avochain_app` y tener solo el rol `avochainApp` sobre la base AvoChain. `MONGODB_ADMIN_URI` se reserva para preparar roles y cuentas. El script idempotente `npm run mongo:roles` crea/actualiza `avochainApp` (lectura y escritura en AvoChain), `avochainAnalyst` (solo lectura) y `avochainInventory` (lectura/escritura de `lotes` y lectura de `fincas`), junto con sus cuentas técnicas. Las contraseñas se guardan en `.env`.

Con MongoDB disponible en Docker, ejecuta `npm run mongo:roles` antes de iniciar la aplicación. En instalaciones nuevas, `mongo/init.js` crea las colecciones y sus validadores; el script actualiza además el validador de `fincas` para permitir estados de aprobación. El usuario root de MongoDB queda para administración, copias de seguridad y restauración, no para ejecutar la API.

Las contraseñas no se guardan en texto plano. MongoDB debe permanecer accesible solo desde la red/localización configurada; cambia las credenciales de ejemplo de Docker antes de publicar el sistema en una red.

## Premium y pagos

El pago Premium se vincula al correo autenticado de la cuenta, no al correo que se escriba libremente en una solicitud. La demostración de pago puede activarse en desarrollo (`PAYMENT_DEMO_ENABLED=true`) y no cobra dinero. Para probar Wompi configura las llaves de sandbox y webhook en `.env`. Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` y `APP_BASE_URL` para enviar activaciones reales; en producción no se aprobará una solicitud si falta la configuración SMTP.

## Alcance de esta versión

El token de sesión es un bearer token firmado; para un despliegue público conviene migrar a cookies `HttpOnly` con protección CSRF, HTTPS, límites de intentos de inicio de sesión y recuperación/cambio de contraseña. La blockchain sigue simulada, las referencias de PDF no se cargan a S3 automáticamente y el GPS registra puntos enviados por el conductor, no rastreo continuo. El registro de evidencias fotográficas también es demostrativo: valida nombre, formato declarado y tamaño, pero el adaptador IPFS actual devuelve una URL simulada y no almacena el archivo.
