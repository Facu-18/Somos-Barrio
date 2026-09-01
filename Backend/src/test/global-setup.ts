import { execSync } from "child_process";
import * as dotenv from "dotenv";
import path from "path";
import { assertTestDatabase } from "./assert-test-database";

export default function setup() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test"), override: true });
  const databaseUrl = assertTestDatabase(process.env["DATABASE_URL"]);

  // Aplicar migraciones en la BD de test
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });
}
