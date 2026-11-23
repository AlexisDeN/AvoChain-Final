require("dotenv/config");
const { MongoClient } = require("mongodb");

const adminUri = process.env.MONGODB_ADMIN_URI || process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE || "avochain";
const required = [
  "MONGO_APP_PASSWORD", "MONGO_ANALYST_PASSWORD", "MONGO_INVENTORY_PASSWORD",
  "MONGO_ROLE_ADMIN_PASSWORD", "MONGO_ROLE_PRODUCTOR_PASSWORD",
  "MONGO_ROLE_INSPECTOR_PASSWORD", "MONGO_ROLE_BODEGA_PASSWORD",
  "MONGO_ROLE_TRANSPORTADOR_PASSWORD", "MONGO_ROLE_RECEPTOR_PASSWORD",
  "MONGO_ROLE_VENDEDOR_PASSWORD"
];
for (const key of required) {
  if (!process.env[key] || process.env[key].includes("replace-with-")) {
    console.error(`Falta configurar ${key} en .env.`);
    process.exit(1);
  }
}
if (!adminUri) {
  console.error("Configura MONGODB_ADMIN_URI con la cuenta administrativa de MongoDB.");
  process.exit(1);
}

const client = new MongoClient(adminUri);

async function asegurarRol(admin, nombre, roles, privileges = []) {
  const info = await admin.command({ rolesInfo: { role: nombre, db: "admin" }, showPrivileges: false });
  const existe = Array.isArray(info.roles) && info.roles.some((r) => r.role === nombre && r.db === "admin");
  const command = {
    [existe ? "updateRole" : "createRole"]: nombre,
    roles,
    privileges
  };
  await admin.command(command);
}

async function asegurarUsuario(admin, nombre, password, roles) {
  const info = await admin.command({ usersInfo: { user: nombre, db: "admin" } });
  const existe = Array.isArray(info.users) && info.users.some((u) => u.user === nombre && u.db === "admin");
  const command = {
    [existe ? "updateUser" : "createUser"]: nombre,
    pwd: password,
    roles
  };
  await admin.command(command);
}

async function main() {
  await client.connect();
  const admin = client.db("admin");

  const database = client.db(dbName);
  const collections = await database.listCollections({ name: "fincas" }).toArray();
  if (collections.length) {
    await database.command({
      collMod: "fincas",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["productorId", "nombreFinca", "registroICA", "ubicacionGPS", "estado"],
          properties: {
            productorId: { bsonType: "objectId" },
            nombreFinca: { bsonType: "string" },
            registroICA: { bsonType: "string" },
            ubicacionGPS: { bsonType: "string" },
            certificadoICA_url: { bsonType: "string" },
            estado: { enum: ["Activa", "Inactiva", "Pendiente de aprobación", "Rechazada"] }
          }
        }
      },
      validationLevel: "strict",
      validationAction: "error"
    });
  }

  await asegurarRol(admin, "avochainApp", [{ role: "readWrite", db: dbName }]);
  await asegurarRol(admin, "avochainAnalyst", [{ role: "read", db: dbName }]);
  await asegurarRol(admin, "avochainInventory", [], [
    { resource: { db: dbName, collection: "lotes" }, actions: ["find", "insert", "update"] },
    { resource: { db: dbName, collection: "fincas" }, actions: ["find"] }
  ]);

  // Roles técnicos de demostración alineados con los módulos de AvoChain.
  // Las reglas por propietario, estado y etapa siguen siendo responsabilidad de la API.
  const rolesNegocio = [
    { role: "avochainAdministrador", envPassword: "MONGO_ROLE_ADMIN_PASSWORD", user: "mongo_administrador_demo", roles: [{ role: "readWrite", db: dbName }] },
    { role: "avochainProductor", envPassword: "MONGO_ROLE_PRODUCTOR_PASSWORD", user: "mongo_productor_demo", privileges: [
      { resource: { db: dbName, collection: "lotes" }, actions: ["find", "insert", "update"] },
      { resource: { db: dbName, collection: "fincas" }, actions: ["find"] }
    ] },
    { role: "avochainInspectorCalidad", envPassword: "MONGO_ROLE_INSPECTOR_PASSWORD", user: "mongo_inspector_calidad_demo", privileges: [
      { resource: { db: dbName, collection: "lotes" }, actions: ["find", "update"] }
    ] },
    { role: "avochainBodeguero", envPassword: "MONGO_ROLE_BODEGA_PASSWORD", user: "mongo_bodeguero_demo", privileges: [
      { resource: { db: dbName, collection: "lotes" }, actions: ["find", "update"] }
    ] },
    { role: "avochainTransportador", envPassword: "MONGO_ROLE_TRANSPORTADOR_PASSWORD", user: "mongo_transportador_demo", privileges: [
      { resource: { db: dbName, collection: "lotes" }, actions: ["find", "update"] }
    ] },
    { role: "avochainReceptor", envPassword: "MONGO_ROLE_RECEPTOR_PASSWORD", user: "mongo_receptor_demo", privileges: [
      { resource: { db: dbName, collection: "lotes" }, actions: ["find", "update"] }
    ] },
    { role: "avochainVendedor", envPassword: "MONGO_ROLE_VENDEDOR_PASSWORD", user: "mongo_vendedor_demo", privileges: [
      { resource: { db: dbName, collection: "lotes" }, actions: ["find", "update"] }
    ] }
  ];
  for (const item of rolesNegocio) {
    await asegurarRol(admin, item.role, item.roles || [], item.privileges || []);
    await asegurarUsuario(admin, item.user, process.env[item.envPassword], [
      { role: item.role, db: "admin" }
    ]);
  }

  await asegurarUsuario(admin, process.env.MONGO_APP_USERNAME || "avochain_app", process.env.MONGO_APP_PASSWORD, [
    { role: "avochainApp", db: "admin" }
  ]);
  await asegurarUsuario(admin, process.env.MONGO_ANALYST_USERNAME || "avochain_analyst", process.env.MONGO_ANALYST_PASSWORD, [
    { role: "avochainAnalyst", db: "admin" }
  ]);
  await asegurarUsuario(admin, process.env.MONGO_INVENTORY_USERNAME || "avochain_inventario", process.env.MONGO_INVENTORY_PASSWORD, [
    { role: "avochainInventory", db: "admin" }
  ]);

  console.log(`Roles MongoDB listos para la base ${dbName}: app, analista, inventario y los siete roles de AvoChain.`);
  console.log("Cuentas técnicas creadas o actualizadas. Sus contraseñas permanecen en .env y no se muestran.");
}

main().catch((error) => {
  console.error("No se pudieron configurar los roles MongoDB:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await client.close().catch(() => {});
});
