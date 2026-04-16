import { logger } from "./logger";
import { prisma } from "../lib/prisma";

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  logger.info("PostgreSQL conectado con Prisma");
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info("Conexion Prisma cerrada");
};
