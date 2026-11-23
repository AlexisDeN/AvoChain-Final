# Datos de práctica de AvoChain

Desde la raíz del proyecto, inicia MongoDB y ejecuta:

```powershell
docker compose up -d mongo
npm run mongo:roles
```

El segundo comando crea o actualiza los roles y usuarios técnicos descritos abajo. Debe ejecutarse con Docker iniciado y las variables `MONGODB_ADMIN_URI` y `MONGO_*` configuradas en `.env`. No elimina datos de las colecciones.

## Roles y usuarios técnicos de MongoDB

| Rol de la app | Rol MongoDB | Usuario técnico | Permisos directos |
|---|---|---|---|
| Administrador | `avochainAdministrador` | `mongo_administrador_demo` | Lectura/escritura en `avochain` |
| Productor | `avochainProductor` | `mongo_productor_demo` | `lotes`: find/insert/update; `fincas`: find |
| Inspector de calidad | `avochainInspectorCalidad` | `mongo_inspector_calidad_demo` | `lotes`: find/update |
| Bodeguero | `avochainBodeguero` | `mongo_bodeguero_demo` | `lotes`: find/update |
| Transportador | `avochainTransportador` | `mongo_transportador_demo` | `lotes`: find/update |
| Receptor | `avochainReceptor` | `mongo_receptor_demo` | `lotes`: find/update |
| Vendedor | `avochainVendedor` | `mongo_vendedor_demo` | `lotes`: find/update |

Además, `avochain_app` tiene lectura/escritura sobre la base para el backend, `avochain_analyst` tiene lectura y `avochain_inventario` puede leer/insertar/actualizar `lotes` y leer `fincas`.

Las contraseñas de las cuentas técnicas de demostración se guardan en `.env` como `MONGO_ROLE_*_PASSWORD`; no se deben publicar. Para probar una cuenta en `mongosh`, usa su usuario y deja que el shell solicite la contraseña:

```powershell
mongosh "mongodb://127.0.0.1:27018/avochain?authSource=admin" --username mongo_productor_demo --password
```

> Estos son usuarios de acceso directo a MongoDB para practicar consultas. MongoDB autoriza por base y colección, no filtra documentos por dueño ni valida la etapa del proceso; por eso estos permisos no reproducen completamente la autorización de la app. El backend sigue autenticando las cuentas de la aplicación y aplicando permisos por rol, propiedad y estado. No uses estas cuentas técnicas para iniciar sesión en la web. El usuario `mongo_administrador_demo` tampoco es un superusuario de MongoDB: solo tiene `readWrite` sobre `avochain`.

Prueba la cuenta de solo lectura del sistema:

```powershell
mongosh "mongodb://127.0.0.1:27018/avochain?authSource=admin" --username avochain_analyst --password
```

`db.lotes.find()` y agregaciones de lectura deben funcionar; `db.lotes.insertOne({})` debe fallar por falta de permisos. MongoDB no tiene una acción independiente llamada `aggregate`; la lectura mediante agregaciones se permite con `find`.

## Cargar datos demo

```powershell
npm run seed:demo
```

El seed crea o actualiza solamente las cuentas con correo `demo.*@avochain.local`, las fincas `DEMO-FINCA-*` y los lotes `DEMO-AVO-*`. Se puede ejecutar más de una vez; no borra ni reemplaza documentos ajenos al conjunto demo.

### Cuentas web demo

Todas las cuentas web generadas usan la contraseña `1234567890`. Hay 40 cuentas con roles de productor, transportador, inspector de calidad, bodeguero, receptor y vendedor. Sus correos siguen el patrón `demo.<rol>.<número>@avochain.local`.

### Datos generados

- 15 fincas asociadas a productores.
- 120 lotes repartidos entre Registrado, Aprobado_Calidad, Rechazado_En_Origen, En Transito, En Punto de Venta y Vendido.
- Inspecciones, QR, despachos, municipios de origen y destino, rutas, puntos de control, incidentes y recepciones.
- Algunas recepciones tienen daños o temperatura máxima de ruta superior a 12 °C para practicar consultas.

Los hashes y enlaces de evidencia son ilustrativos; blockchain, fotos y PDF no se crean ni se suben a servicios externos.