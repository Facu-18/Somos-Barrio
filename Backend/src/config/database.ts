import { logger } from "./logger";
import { prisma } from "../lib/prisma";

const ensureParqueLiceo = async () => {
  const barrio = await prisma.barrio.upsert({
    where: { slug: "parque-liceo" },
    update: {},
    create: {
      name: "Parque Liceo",
      slug: "parque-liceo",
      city: "Cordoba",
      province: "Cordoba",
      country: "AR"
    }
  });

  const subforums = [
    { name: "Consultas", slug: "consultas", description: "Dudas y preguntas del barrio." },
    { name: "Recomendaciones", slug: "recomendaciones", description: "Servicios, locales y experiencias." },
    { name: "Perdidos y Encontrados", slug: "perdidos-encontrados", description: "Mascotas, objetos y avisos." },
    { name: "Eventos", slug: "eventos", description: "Actividades y encuentros comunitarios." },
    { name: "Quejas y Reclamos", slug: "quejas-reclamos", description: "Problemas del barrio y seguimiento." }
  ];

  for (const subforum of subforums) {
    await prisma.forumSubforum.upsert({
      where: { barrioId_slug: { barrioId: barrio.id, slug: subforum.slug } },
      update: {},
      create: { ...subforum, barrioId: barrio.id }
    });
  }
};

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  logger.info("PostgreSQL conectado con Prisma");
  
  if (process.env.NODE_ENV !== 'test') {
    await ensureParqueLiceo();
    logger.info("Barrio fundacional asegurado");
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info("Conexion Prisma cerrada");
};
