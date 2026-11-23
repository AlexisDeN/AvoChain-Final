# Diagramas C4 de AvoChain

El modelo editable está en [`AvoChain.dsl`](./AvoChain.dsl). Se basa en la implementación actual y define estas vistas:

- **C1 — Contexto:** actores, AvoChain y sus servicios externos.
- **C2 — Contenedores:** navegador, servidor Node/Express y MongoDB.
- **C3 — Componentes:** rutas, middleware, controladores, servicios, dominio, repositorio y adaptadores dentro del backend.
- **D1–D3 — Flujos dinámicos:** registro/calidad, despacho/transporte y recepción/venta, separados para facilitar su lectura.
- **C4-despliegue — Despliegue local:** nodos anidados para equipo Windows, navegador, servidor Node.js/Express y Docker/MongoDB; incluye Wompi y SMTP como servicios externos opcionales. MongoDB se expone localmente por el puerto 27018.

Hay dos versiones editables del despliegue: [`AvoChain-Despliegue.puml`](./AvoChain-Despliegue.puml) en PlantUML y [`AvoChain-Despliegue.drawio`](./AvoChain-Despliegue.drawio) en diagrams.net. PlantUML permite mantener el diagrama como texto y regenerarlo fácilmente; draw.io permite acomodar los elementos con el mouse. En cualquiera puedes exportar a PNG o PDF.

## Cómo abrir y exportar

1. Abre el [Structurizr Playground](https://playground.structurizr.com/).
2. Carga `AvoChain.dsl` con la opción de cargar un archivo local.
3. Selecciona cada vista C1, C2, C3, D1, D2, D3 o **C4-despliegue** en el navegador de diagramas.
4. Ajusta el diseño si lo necesitas y exporta las vistas como imágenes para tu informe.

Structurizr DSL es un formato basado en texto para mantener un único modelo y generar las vistas C4; el playground admite cargar el archivo y mostrar sus diagramas. [Documentación oficial de Structurizr DSL](https://docs.structurizr.com/dsl), [guía del playground](https://docs.structurizr.com/playground).

## Decisiones de alcance reflejadas

- El frontend y el API se sirven desde el mismo proceso Express; el navegador ejecuta la interfaz `public/index.html`.
- La base de datos usa MongoDB en Docker.
- Wompi y SMTP son integraciones externas opcionales, si se configuran sus credenciales.
- El adaptador de blockchain y el proveedor IPFS son simulados en esta versión; no se representan como servicios externos reales.
