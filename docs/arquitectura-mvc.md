# Arquitectura MVC de AvoChain

## ¿El proyecto sigue MVC?

Sí, AvoChain tiene responsabilidades que se pueden mapear a Modelo, Vista y Controlador. Además, usa capas de aplicación e infraestructura para mantener los casos de uso y la persistencia separados. Por eso, la forma más precisa de describirlo es **MVC organizado en capas**; no es necesario renombrar todas las carpetas a `model`, `view` y `controller` para que exista esa separación.

La guía de entrega define Modelo como datos, entidades, persistencia y lógica de dominio; Vista como presentación; y Controlador como coordinación de solicitudes entre presentación y modelo. La tabla muestra dónde se encuentran esas responsabilidades en la implementación actual.

| Responsabilidad MVC | Ubicación actual | Qué hace |
|---|---|---|
| Vista (View) | `public/index.html` | Presenta las pantallas y formularios. Su JavaScript consume la API REST y actualiza la interfaz. |
| Controlador (Controller) | `src/presentation/controllers/` | Recibe solicitudes HTTP, toma parámetros y datos de sesión, invoca servicios y construye respuestas JSON. |
| Enrutamiento y composición | `src/app.ts` | Configura Express, conecta rutas con controladores, aplica middleware y crea las dependencias. No debería contener reglas del negocio. |
| Modelo (Model) | `src/domain/` | Contiene las entidades y reglas del dominio, como lotes, usuarios, roles, estados y calidad. |
| Acceso a datos del Modelo | `src/infrastructure/database/` | Implementa la persistencia MongoDB y el repositorio de datos. |
| Coordinación de casos de uso | `src/application/` | Ejecuta operaciones de aplicación entre los controladores, el dominio y los repositorios. Es una capa adicional a MVC que ayuda a mantener responsabilidades claras. |

## Recorrido de una solicitud

Ejemplo: un productor registra un lote.

1. El productor diligencia el formulario en `public/index.html` (Vista).
2. La interfaz envía una solicitud HTTP a `POST /api/v1/lotes`.
3. Express aplica autenticación y permisos en `src/app.ts`, y deriva la solicitud a `AvoChainFacadeController`.
4. El controlador obtiene los datos de la solicitud y la identidad autenticada, y llama al servicio de aplicación.
5. El servicio coordina las reglas del dominio y el repositorio.
6. El repositorio guarda el lote en MongoDB.
7. El controlador devuelve el resultado como JSON y la Vista actualiza la pantalla.

```mermaid
sequenceDiagram
    actor Productor
    participant V as Vista<br/>public/index.html
    participant R as Rutas y middleware<br/>src/app.ts
    participant C as Controlador<br/>AvoChainFacadeController
    participant A as Servicio de aplicación
    participant M as Modelo de dominio
    participant P as Repositorio MongoDB
    database DB as MongoDB

    Productor->>V: Completa formulario de lote
    V->>R: POST /api/v1/lotes + token
    R->>R: Autentica y verifica rol
    R->>C: Deriva solicitud
    C->>A: registrarLote(datos, usuario autenticado)
    A->>M: Aplica reglas del lote
    A->>P: Guarda lote
    P->>DB: Inserta documento
    DB-->>P: Lote persistido
    P-->>A: Lote guardado
    A-->>C: Resultado del caso de uso
    C-->>V: Respuesta JSON
    V-->>Productor: Actualiza la pantalla
```

## Qué conviene explicar en la entrega

- MVC describe la separación de presentación, solicitudes y modelo; no significa que la aplicación tenga que ser monolítica ni que cada acción deba concentrarse en un único archivo.
- La capa `application` se ubica entre controladores y dominio/repositorios para coordinar casos de uso. No sustituye al Modelo ni convierte la Vista en un controlador.
- `src/app.ts` es el punto de ensamblaje y enrutamiento de Express. Las reglas de negocio deben permanecer en `application` y `domain`, y no añadirse a las funciones de ruta.
- La Vista actual está concentrada en `public/index.html`, incluido su JavaScript. Cumple el rol de interfaz, aunque separar HTML, CSS y JavaScript en archivos propios facilitaría su mantenimiento. Esa separación es una mejora de organización, no un requisito para que exista MVC.
- Los permisos deben seguir validándose en el backend. Ocultar botones en la Vista por sí solo no protege las operaciones.

## Resumen para exposición

> AvoChain usa MVC con arquitectura por capas. La Vista está en `public/index.html`; los controladores HTTP están en `src/presentation/controllers`; el Modelo reúne entidades y reglas en `src/domain` y persistencia en `src/infrastructure/database`. Los servicios de `src/application` coordinan los casos de uso entre controladores y modelo. `src/app.ts` configura rutas, middleware y dependencias. Así, cada capa tiene una responsabilidad identificable y la interfaz no accede directamente a MongoDB.
