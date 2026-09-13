import bcrypt from "bcryptjs";
import { AuthProvider, BusinessCategory, MarketplaceCategory, MarketplaceAvailability, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
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

  const adminPasswordHash = await bcrypt.hash("Admin1234!", 12);
  const userPasswordHash = await bcrypt.hash("Vecino1234!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@somosbarrio.local" },
    update: { barrioId: barrio.id, nickname: "Somos Barrio" },
    create: {
      email: "admin@somosbarrio.local",
      name: "Admin Somos Barrio",
      nickname: "Somos Barrio",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      authProvider: AuthProvider.LOCAL,
      barrioId: barrio.id
    }
  });

  const vecinoUser = await prisma.user.upsert({
    where: { email: "vecino@somosbarrio.local" },
    update: { barrioId: barrio.id, nickname: "Juancito" },
    create: {
      email: "vecino@somosbarrio.local",
      name: "Juan Perez",
      nickname: "Juancito",
      bio: "Vecino del barrio de toda la vida.",
      avatarUrl: "https://i.pravatar.cc/150?u=juan",
      passwordHash: userPasswordHash,
      role: UserRole.VECINO,
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
      where: { barrioId_slug: { barrioId: barrio.id, slug: subforum.slug } },
      update: {},
      create: { ...subforum, barrioId: barrio.id }
    });
  }

  const negocioOwner = await prisma.user.upsert({
    where: { email: "local@somosbarrio.local" },
    update: { barrioId: barrio.id, nickname: "Comerciante" },
    create: {
      email: "local@somosbarrio.local",
      name: "Comerciante Demo",
      nickname: "Comerciante",
      passwordHash: await bcrypt.hash("Local1234!", 12),
      role: UserRole.NEGOCIO,
      authProvider: AuthProvider.LOCAL,
      barrioId: barrio.id
    }
  });

  const businesses = [
    {
      ownerId: negocioOwner.id,
      barrioId: barrio.id,
      name: "Cafeteria Esquina Demo",
      slug: "cafeteria-esquina-demo",
      category: BusinessCategory.GASTRONOMIA,
      address: "Av. Rancagua 4500",
      description: "Cafe de especialidad y pasteleria artesanal en el corazon del Parque Liceo.",
      verified: true,
      photos: ["https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80"],
      phone: "3510001111",
      whatsapp: "+543510001111"
    },
    {
      ownerId: adminUser.id,
      barrioId: barrio.id,
      name: "Ferreteria El Clavo",
      slug: "ferreteria-el-clavo",
      category: BusinessCategory.HOGAR,
      address: "Av. Rancagua 4620",
      description: "Todo en herramientas, pintura y materiales de construccion.",
      verified: true,
      photos: ["https://images.unsplash.com/photo-1533758349247-49f993d0d33e?auto=format&fit=crop&w=400&q=80"],
      whatsapp: "+543510002222"
    },
    {
      ownerId: vecinoUser.id,
      barrioId: barrio.id,
      name: "Canchas Liceo",
      slug: "canchas-liceo",
      category: BusinessCategory.DEPORTES,
      address: "Calle Constancio Vigil 1200",
      description: "Canchas de futbol 5 y 7. Torneos los fines de semana.",
      verified: false,
      photos: ["https://images.unsplash.com/photo-1556942040-410a0a5200ec?auto=format&fit=crop&w=400&q=80"],
    }
  ];

  for (const b of businesses) {
    await prisma.business.upsert({
      where: { slug: b.slug },
      update: {},
      create: b
    });
  }

  // Marketplace Posts
  const marketplacePosts = [
    {
      userId: vecinoUser.id,
      barrioId: barrio.id,
      title: "Bicicleta Playera usada",
      description: "Excelente estado, cubiertas nuevas. Vendo por falta de uso.",
      price: 45000,
      currency: "ARS",
      category: MarketplaceCategory.DEPORTES,
      availability: MarketplaceAvailability.AVAILABLE,
      images: [],
       whatsapp: "+5493510000000"
    },
    {
      userId: adminUser.id,
      barrioId: barrio.id,
      title: "Silla de oficina ergonomica",
      description: "Regulable en altura y apoyo lumbar. Ideal home office.",
      price: 60000,
      currency: "ARS",
      category: MarketplaceCategory.MUEBLES,
      availability: MarketplaceAvailability.AVAILABLE,
      images: [],
      whatsapp: "+5493510002222"
    },
    {
      userId: negocioOwner.id,
      barrioId: barrio.id,
      title: "Notebook Dell I5",
      description: "8gb Ram, SSD 256. Bateria dura 2 horas. Cargador original.",
      price: 250000,
      currency: "ARS",
      category: MarketplaceCategory.ELECTRONICA,
      availability: MarketplaceAvailability.AVAILABLE,
      images: [],
      whatsapp: "+5493510001111"
    }
  ];

  for (const p of marketplacePosts) {
    const existing = await prisma.marketplacePost.findFirst({
      where: { userId: p.userId, barrioId: p.barrioId, title: p.title }
    });
    if (!existing) await prisma.marketplacePost.create({ data: p });
  }

  // A couple of forum threads
  const consultasId = (await prisma.forumSubforum.findFirst({ where: { barrioId: barrio.id, slug: "consultas" } }))?.id;
  if (consultasId && !await prisma.forumThread.findFirst({ where: { subforumId: consultasId, title: "¿Alguien sabe si paso el basurero hoy?" } })) {
    await prisma.forumThread.create({
      data: {
        userId: vecinoUser.id,
        barrioId: barrio.id,
        subforumId: consultasId,
        title: "¿Alguien sabe si paso el basurero hoy?",
        content: "En mi cuadra todavia no pasaron y esta lleno de bolsas.",
      }
    });
  }

  const recomendacionesId = (await prisma.forumSubforum.findFirst({ where: { barrioId: barrio.id, slug: "recomendaciones" } }))?.id;
  if (recomendacionesId && !await prisma.forumThread.findFirst({ where: { subforumId: recomendacionesId, title: "Excelente la nueva ferreteria" } })) {
    await prisma.forumThread.create({
      data: {
        userId: adminUser.id,
        barrioId: barrio.id,
        subforumId: recomendacionesId,
        title: "Excelente la nueva ferreteria",
        content: "Fui a El Clavo y me atendieron barbaro, muy buenos precios.",
      }
    });
  }
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
