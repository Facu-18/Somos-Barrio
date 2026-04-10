import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor listo en http://localhost:${env.PORT}${env.API_PREFIX}`);
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Recibido ${signal}. Cerrando servicios...`);

  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    logger.info("Servicios cerrados correctamente");
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    logger.error({ error }, "Error cerrando SIGINT");
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    logger.error({ error }, "Error cerrando SIGTERM");
    process.exit(1);
  });
});
