import { execSync } from "child_process";
import * as dotenv from "dotenv";
import path from "path";

export default function setup() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

  // Aplicar migraciones en la BD de test
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5434/somos-barrio-test?schema=public",
    },
    stdio: "inherit",
  });
}
