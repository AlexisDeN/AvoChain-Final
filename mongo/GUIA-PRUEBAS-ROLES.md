# Pruebas de permisos por rol en AvoChain

Esta guía comprueba los permisos **de la aplicación**. Cada prueba inicia sesión con una cuenta web demo, llama a una operación que pertenece a otro rol y debe recibir `HTTP 403`. No son pruebas de usuarios `mongo_*_demo`: esos son accesos directos a MongoDB y no tienen los permisos funcionales de la aplicación.

## Requisitos

- Backend activo en `http://localhost:3001` y conectado a MongoDB.
- Datos demo cargados con `npm run seed:demo`.
- Cuentas web demo: contraseña `1234567890`.

## 1. Pega esta función en PowerShell

La función inicia sesión con el correo indicado, obtiene el token y llama a la ruta prohibida para ese rol.

```powershell
function Probar-Rechazo($correo, $ruta) {
  $sesion = Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:3001/api/v1/auth/login" `
    -ContentType "application/json" `
    -Body (@{ email = $correo; password = "1234567890" } | ConvertTo-Json)

  try {
    $respuesta = Invoke-WebRequest `
      -Method Post `
      -Uri "http://localhost:3001$ruta" `
      -Headers @{ Authorization = "Bearer $($sesion.token)" } `
      -ContentType "application/json" `
      -Body "{}" `
      -ErrorAction Stop
    "No se esperaba éxito: HTTP $([int]$respuesta.StatusCode)"
  } catch {
    $codigo = [int]$_.Exception.Response.StatusCode
    if ($codigo -eq 403) { "Correcto: HTTP 403, permiso denegado para $correo" }
    else { "Resultado inesperado: HTTP $codigo para $correo; revisa la sección Si no sale HTTP 403." }
  }
}
```

## 2. Ejecuta una prueba diferente por rol

Copia y pega **una línea a la vez**, después de definir la función. Cada una debe mostrar `Correcto: HTTP 403, permiso denegado`.

### Productor: no puede confirmar recepción

```powershell
Probar-Rechazo "demo.productor.01@avochain.local" "/api/v1/lotes/DEMO-AVO-0001/recepcion-destino"
```

La recepción corresponde al Receptor.

### Inspector de calidad: no puede registrar un lote

```powershell
Probar-Rechazo "demo.inspector-de-calidad.01@avochain.local" "/api/v1/lotes"
```

El registro de lotes corresponde al Productor.

### Bodeguero: no puede reportar incidentes de ruta

```powershell
Probar-Rechazo "demo.bodeguero.01@avochain.local" "/api/v1/lotes/DEMO-AVO-0001/incidentes"
```

Los incidentes corresponden al Transportador.

### Transportador: no puede hacer la inspección de calidad

```powershell
Probar-Rechazo "demo.transportador.01@avochain.local" "/api/v1/lotes/DEMO-AVO-0001/inspeccion-calidad"
```

La inspección corresponde al Inspector de calidad.

### Receptor: no puede registrar la venta

```powershell
Probar-Rechazo "demo.receptor.01@avochain.local" "/api/v1/lotes/DEMO-AVO-0001/venta"
```

La venta corresponde al Vendedor.

### Vendedor: no puede despachar ni asignar conductor

```powershell
Probar-Rechazo "demo.vendedor.01@avochain.local" "/api/v1/lotes/DEMO-AVO-0001/despacho"
```

El despacho corresponde al Bodeguero.

### Administrador: no puede registrar una lectura QR de transporte

Inicia sesión con la cuenta Administrador configurada en `.env`, copia el token de la respuesta y úsalo aquí:

```powershell
$tokenAdmin = "PEGA_AQUI_EL_TOKEN_DEL_ADMIN"
try {
  Invoke-WebRequest -Method Post -Uri "http://localhost:3001/api/v1/lotes/DEMO-AVO-0001/qr/lectura" -Headers @{ Authorization = "Bearer $tokenAdmin" } -ContentType "application/json" -Body "{}" -ErrorAction Stop
  "No se esperaba éxito."
} catch {
  $codigo = [int]$_.Exception.Response.StatusCode
  if ($codigo -eq 403) { "Correcto: HTTP 403, permiso denegado para Administrador" }
  else { "Resultado inesperado: HTTP $codigo" }
}
```

La lectura del QR durante la ruta corresponde al Transportador.
## Si no sale HTTP 403

- `401`: el inicio de sesión/token falló. Confirma correo, contraseña, backend activo y que la cuenta esté sembrada.
- `404`: comprueba que la ruta esté escrita igual y que uses un lote demo existente. Las rutas que verifican primero el rol deben rechazar al usuario con 403 antes de consultar el lote.
- `400` o `500`: confirma que el backend esté conectado a MongoDB y que ejecutaste `npm run seed:demo`.
- `200`: revisa que la cuenta tenga el rol esperado en `db.usuarios`; la operación debía ser rechazada para ese rol.

## Por qué esto no se prueba igual en mongosh

Los permisos `mongo_*_demo` de mongosh son permisos técnicos. En la colección `lotes`, calidad, despacho, incidentes, recepción y venta están embebidos dentro del mismo documento. MongoDB autoriza por colección, no por cada campo o etapa. Por eso las diferencias funcionales entre roles se comprueban en las rutas protegidas de AvoChain, como en las pruebas de arriba.
## Confirmar que cada rol sí puede hacer su tarea

Las pruebas anteriores eran negativas. Para comprobar también permisos aceptados, ejecuta este flujo pequeño de extremo a extremo con las cuentas web demo. **Crea un lote nuevo de práctica y lo deja vendido**; no modifica los lotes demo existentes. Hazlo en tu base de práctica, no en datos reales. Debes tener activo el backend, las cuentas demo y al menos una finca aprobada para `demo.productor.01` (el seed crea `DEMO-FINCA-001`).

Pega el bloque completo en PowerShell. Cada paso debe terminar sin error; al final muestra el código del lote creado.

```powershell
$base = "http://localhost:3001"
function Login-Avo($correo) {
  (Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType "application/json" -Body (@{ email = $correo; password = "1234567890" } | ConvertTo-Json)).token
}
function Call-Avo($token, $metodo, $ruta, $datos = $null) {
  $request = @{ Method = $metodo; Uri = "$base$ruta"; Headers = @{ Authorization = "Bearer $token" } }
  if ($null -ne $datos) { $request.ContentType = "application/json"; $request.Body = $datos | ConvertTo-Json -Depth 8 }
  Invoke-RestMethod @request
}

# Productor: consulta su finca aprobada y registra un lote nuevo.
$prod = Login-Avo "demo.productor.01@avochain.local"
$fincas = Call-Avo $prod "GET" "/api/v1/fincas"
$finca = $fincas | Where-Object { $_.activa -eq $true } | Select-Object -First 1
if (-not $finca) { throw "El productor no tiene finca activa/aprobada. Ejecuta npm run seed:demo y revisa DEMO-FINCA-001." }
$fecha = (Get-Date).ToUniversalTime().ToString("o")
$lote = Call-Avo $prod "POST" "/api/v1/lotes" @{ fincaId = $finca.id; pesoKg = 25; variedad = "Hass"; fechaCosecha = $fecha }
$id = [uri]::EscapeDataString($lote.id)
"Productor OK: lote registrado $($lote.id)"

# Inspector: aprueba el lote recién registrado.
$inspector = Login-Avo "demo.inspector-de-calidad.01@avochain.local"
$null = Call-Avo $inspector "POST" "/api/v1/lotes/$id/inspeccion-calidad" @{ destino = "Nacional"; humedad = 65; temperaturaC = 6; evaluacionFitosanitaria = "Aprobada"; informePdfMimeType = "application/pdf"; informePdfUrl = "https://demo.invalid/informe-prueba.pdf"; informePdfSizeBytes = 1200 }
"Inspector OK: inspección aprobada"

# Bodeguero: genera QR y despacha al conductor demo.
$bodega = Login-Avo "demo.bodeguero.01@avochain.local"
$null = Call-Avo $bodega "POST" "/api/v1/lotes/$id/qr" @{}
$transportador = Login-Avo "demo.transportador.01@avochain.local"
$transportadorPerfil = Call-Avo $transportador "GET" "/api/v1/auth/me"
$null = Call-Avo $bodega "POST" "/api/v1/lotes/$id/despacho" @{ conductorId = $transportadorPerfil.walletAddress; conductorNombre = $transportadorPerfil.nombre; pinConfirmacion = "1234"; origenMunicipio = "Pereira"; destinoMunicipio = "Bogotá" }
"Bodeguero OK: QR generado y lote despachado"

# Transportador: registra un punto GPS del trayecto.
$null = Call-Avo $transportador "POST" "/api/v1/lotes/$id/ruta/puntos" @{ ubicacion = @{ latitud = 4.5709; longitud = -74.2973; referencia = "Punto de prueba" }; observacion = "Prueba de permisos por rol" }
"Transportador OK: punto de ruta registrado"

# Receptor: confirma llegada con temperatura válida.
$receptor = Login-Avo "demo.receptor.01@avochain.local"
$null = Call-Avo $receptor "POST" "/api/v1/lotes/$id/recepcion-destino" @{ temperaturaC = 6; cajasDanadas = 0; temperaturaMaximaRutaC = 8 }
"Receptor OK: recepción confirmada"

# Vendedor: registra la venta del lote de práctica.
$vendedor = Login-Avo "demo.vendedor.01@avochain.local"
$null = Call-Avo $vendedor "POST" "/api/v1/lotes/$id/venta" @{}
"Vendedor OK: venta registrada; lote $($lote.id)"
```

Para confirmar la tarea del **Administrador**, usa las credenciales `ADMIN_EMAIL` y `ADMIN_PASSWORD` de `.env`:

```powershell
$correoAdmin = Read-Host "ADMIN_EMAIL"
$claveSegura = Read-Host "ADMIN_PASSWORD" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($claveSegura)
try { $claveAdmin = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$admin = (Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType "application/json" -Body (@{ email = $correoAdmin; password = $claveAdmin } | ConvertTo-Json)).token
$usuarios = Call-Avo $admin "GET" "/api/v1/usuarios"
"Administrador OK: consulta de usuarios ($($usuarios.Count) registros)"
```

El Administrador no participa en el flujo productivo del lote: su función es administrar usuarios, fincas y seguimiento global.
