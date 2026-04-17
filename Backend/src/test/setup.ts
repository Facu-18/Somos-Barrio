import * as dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll } from "vitest";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5434/somos-barrio-test?schema=public",
    },
  },
});

// Limpiar todas las tablas antes de cada suite de tests
beforeAll(async () => {
  await prisma.$transaction([
    prisma.forumVote.deleteMany(),
    prisma.forumReply.deleteMany(),
    prisma.forumThread.deleteMany(),
    prisma.forumSubforum.deleteMany(),
    prisma.eventRsvp.deleteMany(),
    prisma.event.deleteMany(),
    prisma.review.deleteMany(),
    prisma.message.deleteMany(),
    prisma.marketplacePost.deleteMany(),
    prisma.news.deleteMany(),
    prisma.business.deleteMany(),
    prisma.user.deleteMany(),
    prisma.barrio.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
