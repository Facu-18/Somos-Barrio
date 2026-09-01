import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

let server: ReturnType<typeof app.listen> | undefined;
let shuttingDown = false;

const startServer = async (): Promise<void> => {
  await connectDatabase();
  await redis.connect();

  server = app.listen(env.PORT, () => {
    logger.info(`Servidor listo en http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
};

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Recibido ${signal}. Cerrando servicios...`);

  const forceClose = setTimeout(() => {
    server?.closeAllConnections();
  }, 10_000);
  forceClose.unref();

  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((error) => error ? reject(error) : resolve());
  });

  clearTimeout(forceClose);
  await Promise.allSettled([disconnectDatabase(), redis.quit()]);
  logger.info("Servicios cerrados correctamente");
};

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    logger.error({ err: error }, "Error cerrando SIGINT");
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    logger.error({ err: error }, "Error cerrando SIGTERM");
    process.exit(1);
  });
});

startServer().catch(async (error) => {
  logger.error({ err: error }, "Error iniciando servidor");
  await prisma.$disconnect();
  await redis.quit();
  process.exit(1);
});
