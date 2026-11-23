export const ROLES = [
  "Administrador",
  "Productor",
  "Inspector de calidad",
  "Bodeguero",
  "Transportador",
  "Receptor",
  "Vendedor"
] as const;

export type Rol = typeof ROLES[number];
export const ROLES_ASIGNABLES: readonly Rol[] = ROLES.filter((rol) => rol !== "Administrador");

export function normalizarRol(value: unknown): string {
  const rol = String(value || "").trim();
  return ["Conductor", "Transportista"].includes(rol) ? "Transportador" : rol;
}

export function esRol(value: unknown): value is Rol {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function esRolAsignable(value: unknown): value is Exclude<Rol, "Administrador"> {
  return typeof value === "string" && (ROLES_ASIGNABLES as readonly string[]).includes(value);
}
