import bcrypt from "bcryptjs";
import { AuthProvider, BusinessCategory, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const barrio = await prisma.barrio.upsert({
    where: { slug: "villa-crespo" },
    update: {},
    create: {
      name: "Villa Crespo",
      slug: "villa-crespo",
      city: "Buenos Aires",
      province: "CABA",
      country: "AR"
    }
  });

  const adminPasswordHash = await bcrypt.hash("Admin1234!", 12);

  await prisma.user.upsert({
    where: { email: "admin@somosbarrio.local" },
    update: {},
    create: {
      email: "admin@somosbarrio.local",
      name: "Admin Somos Barrio",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      authProvider: AuthProvider.LOCAL,
      barrioId: barrio.id
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
      where: {
        barrioId_slug: {
          barrioId: barrio.id,
          slug: subforum.slug
        }
      },
      update: {},
      create: {
        ...subforum,
        barrioId: barrio.id
      }
    });
  }

  const negocioOwner = await prisma.user.upsert({
    where: { email: "local@somosbarrio.local" },
    update: {},
    create: {
      email: "local@somosbarrio.local",
      name: "Comerciante Demo",
      passwordHash: await bcrypt.hash("Local1234!", 12),
      role: UserRole.NEGOCIO,
      authProvider: AuthProvider.LOCAL,
      barrioId: barrio.id
    }
  });

  await prisma.business.upsert({
    where: { slug: "cafeteria-esquina-demo" },
    update: {},
    create: {
      ownerId: negocioOwner.id,
      barrioId: barrio.id,
      name: "Cafeteria Esquina Demo",
      slug: "cafeteria-esquina-demo",
      category: BusinessCategory.GASTRONOMIA,
      address: "Av. Corrientes 4500",
      description: "Cafe de especialidad y pasteleria artesanal.",
      verified: false,
      photos: []
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
