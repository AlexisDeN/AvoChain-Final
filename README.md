# AvoChain

Plataforma web para gestionar la trazabilidad de lotes de aguacate desde el registro de cosecha hasta la venta. La solución permite administrar usuarios y fincas, registrar lotes, evaluar su calidad, coordinar despacho y transporte, confirmar recepción y consultar el historial.

El sistema está desarrollado con TypeScript, Node.js, Express y MongoDB. La persistencia principal es MongoDB; los adaptadores de blockchain y almacenamiento de evidencias son simulados en esta versión.

## Tabla de contenido

- [Capacidades](#capacidades)
- [Tecnologías](#tecnologías)
- [Arquitectura](#arquitectura)
- [Patrones de diseño](#patrones-de-diseño)
- [Documentación y diagramas](#documentación-y-diagramas)
- [Requisitos](#requisitos)
- [Instalación y ejecución local](#instalación-y-ejecución-local)
- [Configuración](#configuración)
- [Datos de demostración](#datos-de-demostración)
- [Scripts disponibles](#scripts-disponibles)
- [Alcance y limitaciones](#alcance-y-limitaciones)

## Capacidades

- Autenticación de usuarios y autorización por rol en el backend.
- Administración de usuarios, solicitudes de vinculación y fincas.
- Registro de lotes asociados a fincas aprobadas.
- Inspección de calidad y transiciones de estado del lote.
- Generación y lectura de códigos QR, despacho y asignación de transportador.
- Registro de puntos de control e incidentes durante el transporte.
- Confirmación de recepción y registro de venta.
- Persistencia de usuarios, fincas, lotes, pagos, Premium y solicitudes en MongoDB.
- Integración opcional con Wompi y SMTP mediante variables de entorno.

### Roles de negocio

| Rol | Responsabilidad principal |
|---|---|
| Administrador | Administra usuarios y fincas, aprueba solicitudes y consulta la trazabilidad global. |
| Productor | Solicita fincas y registra lotes vinculados a sus fincas aprobadas. |
| Inspector de calidad | Evalúa los lotes y registra el resultado de la inspección. |
| Bodeguero | Genera QR y despacha lotes asignando un transportador. |
| Transportador | Registra puntos de control e incidentes de los lotes asignados. |
| Receptor | Confirma la recepción de los lotes en destino. |
| Vendedor | Registra la venta de lotes recibidos. |

## Tecnologías

- **Backend:** Node.js, TypeScript y Express.
- **Base de datos:** MongoDB 8.
- **Contenedores locales:** Docker Compose.
- **Interfaz:** HTML, CSS y JavaScript servidos por Express desde `public/`.
- **Integraciones opcionales:** Wompi para pagos y SMTP para correo.

## Arquitectura

AvoChain organiza MVC en capas. La capa de aplicación coordina casos de uso y la infraestructura implementa persistencia e integraciones.

| Responsabilidad | Ubicación | Descripción |
|---|---|---|
| Vista | `public/index.html` | Interfaz web y comunicación HTTP con la API. |
| Controladores | `src/presentation/controllers/` | Adaptan solicitudes y respuestas HTTP a operaciones de aplicación. |
| Rutas y composición | `src/app.ts` | Configura Express, rutas, middleware y dependencias. |
| Modelo de dominio | `src/domain/` | Entidades y reglas del negocio: lotes, fincas, usuarios, calidad y estados. |
| Casos de uso | `src/application/` | Coordina operaciones entre controladores, dominio y repositorios. |
| Persistencia e integraciones | `src/infrastructure/` | Repositorios MongoDB y adaptadores externos. |

El recorrido típico es: Vista → ruta y middleware → controlador → servicio de aplicación → dominio/repositorio → MongoDB. La autorización se valida en el backend; la interfaz no accede directamente a la base de datos.

La explicación detallada del mapeo MVC y un diagrama de secuencia están en [docs/arquitectura-mvc.md](docs/arquitectura-mvc.md).

## Patrones de diseño

Los patrones identificados en la implementación contribuyen a separar reglas y facilitar la evolución de los componentes:

| Patrón | Implementación | Justificación |
|---|---|---|
| **Strategy** | `src/domain/quality/QualityStrategy.ts` | Permite evaluar criterios de calidad según el destino del producto sin concentrar todas las variantes en una sola regla. |
| **State** | `src/domain/state/LoteState.ts` | Representa estados y transiciones permitidas del lote a lo largo de su ciclo de vida. |
| **Builder** | `src/domain/entities/FincaBuilder.ts` | Construye una finca configurando sus datos paso a paso antes de crear la entidad. |
| **Singleton** | `src/domain/entities/QRGeneratorSingleton.ts` | Centraliza el acceso a la instancia del generador QR. |
| **Factory** | `src/infrastructure/factories/StorageFactory.ts` | Encapsula la selección y creación del proveedor de almacenamiento. |
| **Proxy** | `src/infrastructure/adapters/BlockchainAdapter.ts` (`OfflineScanProxy`) | Intermedia lecturas QR cuando no hay conexión y permite gestionar el comportamiento offline simulado. |
| **Chain of Responsibility** | `src/application/services/ReceptionValidationChain.ts` | Ejecuta validaciones de recepción mediante una cadena de comprobaciones. |
| **Adapter** | `src/infrastructure/adapters/BlockchainAdapter.ts` | Expone operaciones de blockchain mediante un adaptador intercambiable; en esta versión, la implementación es simulada. |

## Documentación y diagramas

- [Arquitectura MVC](docs/arquitectura-mvc.md): responsabilidades de las capas y flujo de una solicitud.
- [Modelo C4 y arquitectura](docs/c4/README.md): descripción de las vistas y pasos para abrir/exportar el modelo.
- [Modelo C4 editable](docs/c4/AvoChain.dsl): define contexto, contenedores, componentes, flujos dinámicos y despliegue local.
- [Despliegue PlantUML](docs/c4/AvoChain-Despliegue.puml) y [despliegue Draw.io](docs/c4/AvoChain-Despliegue.drawio): fuentes editables del despliegue.
- [Diagramas de componentes y clases](docs/diagramas-arquitectura.md).
- [Casos de uso PlantUML](docs/casos-de-uso-organizados.puml) y [versión PDF](output/pdf/Casos_de_uso_AvoChain_ordenados.pdf).
- [Inicialización y roles MongoDB](mongo/README.md).

### Entregables complementarios

Las [historias de usuario y los diagramas finales en PNG](https://drive.google.com/drive/folders/1oQ31i4B-G67fLRe4Xo4kfkV8QDMqmneJ?usp=sharing) se encuentran en la carpeta compartida del proyecto.

## Requisitos

- Node.js y npm.
- Docker Desktop con Docker Compose.
- Git para clonar el repositorio.

## Instalación y ejecución local

Ejecuta los comandos desde la raíz del repositorio.

1. Clona el repositorio y entra a la carpeta:

   ```powershell
   git clone <URL_DEL_REPOSITORIO>
   cd <CARPETA_DEL_REPOSITORIO>
   ```

2. Instala dependencias y crea la configuración local:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

3. Edita `.env` con secretos y credenciales locales. Consulta [Configuración](#configuración). No subas este archivo al repositorio.

4. Inicia MongoDB:

   ```powershell
   docker compose up -d mongo
   ```

5. Crea los roles y usuarios técnicos de MongoDB:

   ```powershell
   npm run mongo:roles
   ```

6. Compila TypeScript y arranca el servidor:

   ```powershell
   npm run build
   npm start
   ```

7. Abre [http://localhost:3001](http://localhost:3001). El endpoint de salud está disponible en [http://localhost:3001/health](http://localhost:3001/health).

Para desarrollo con recarga automática, inicia MongoDB y sus roles como arriba y ejecuta `npm run dev` en lugar de `npm start`.

## Configuración

La plantilla de variables está en [`.env.example`](.env.example). Como mínimo, configura valores propios para:

- `AUTH_TOKEN_SECRET`: secreto aleatorio de al menos 32 bytes.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_WALLET`: cuenta administradora inicial; la contraseña debe tener al menos 12 caracteres.
- `MONGODB_ADMIN_URI`: conexión administrativa usada para preparar roles.
- `MONGODB_URI`: conexión del backend con el usuario de aplicación `avochain_app`.
- `MONGO_APP_PASSWORD`, `MONGO_ANALYST_PASSWORD`, `MONGO_INVENTORY_PASSWORD` y `MONGO_ROLE_*_PASSWORD`: credenciales creadas por `npm run mongo:roles`.

La contraseña incluida en `MONGODB_URI` debe coincidir con `MONGO_APP_PASSWORD`. Para el entorno local, `docker-compose.yml` publica MongoDB en el puerto `27018`. Si cambias las credenciales root de Docker, actualiza también `MONGODB_ADMIN_URI`.

Wompi y SMTP son opcionales para el funcionamiento local básico. Completa sus variables en `.env` únicamente al probar esos flujos. Usa credenciales de sandbox para Wompi.

## Datos de demostración

El conjunto de datos de práctica se carga con:

```powershell
npm run seed:demo
```

El seed crea o actualiza cuentas `demo.*@avochain.local`, fincas `DEMO-FINCA-*` y lotes `DEMO-AVO-*`. Las cuentas web de demostración usan una contraseña conocida documentada en [mongo/README.md](mongo/README.md); utiliza estos datos únicamente en un entorno local y nunca en un despliegue público.

## Scripts disponibles

| Comando | Uso |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo con recarga automática. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la compilación existente en `dist/`. |
| `npm run typecheck` | Comprueba tipos TypeScript sin emitir archivos. |
| `npm run mongo:roles` | Crea o actualiza roles y cuentas técnicas de MongoDB. |
| `npm run seed:demo` | Carga datos de práctica para la aplicación. |

## Alcance y limitaciones

- El adaptador blockchain genera hashes de demostración; no envía transacciones a una red blockchain.
- El proveedor IPFS de esta versión devuelve enlaces simulados y no almacena los archivos de evidencia.
- Los puntos GPS son registrados por el transportador; no existe rastreo continuo automático.
- Los pagos de demostración no realizan cobros. Para probar Wompi deben configurarse credenciales de sandbox.
- Para un despliegue público se requiere configurar HTTPS, proteger sesiones y secretos, y revisar los controles de seguridad y operación del entorno.
