export function assertTestDatabase(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL es obligatoria para tests de integracion");
  }

  let databaseName: string;
  try {
    databaseName = new URL(databaseUrl).pathname.slice(1);
  } catch {
    throw new Error("DATABASE_URL de tests no es una URL valida");
  }

  if (databaseName !== "somos-barrio-test") {
    throw new Error(
      `Tests de integracion bloqueados: la base debe ser somos-barrio-test, no ${databaseName || "desconocida"}`
    );
  }

  return databaseUrl;
}
