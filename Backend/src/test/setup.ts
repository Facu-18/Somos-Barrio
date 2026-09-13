import * as dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll } from "vitest";
import { assertTestDatabase } from "./assert-test-database";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test"), override: true });
const databaseUrl = assertTestDatabase(process.env["DATABASE_URL"]);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// Limpiar todas las tablas antes de cada suite de tests
beforeAll(async () => {
  await prisma.$transaction([
    prisma.notificationOutbox.deleteMany(),
    prisma.pushDevice.deleteMany(),
    prisma.forumReport.deleteMany(),
    prisma.forumAppeal.deleteMany(),
    prisma.forumModerationDecision.deleteMany(),
    prisma.forumVote.deleteMany(),
    prisma.forumReply.deleteMany(),
    prisma.forumThread.deleteMany(),
    prisma.forumSubforum.deleteMany(),
    prisma.eventRsvp.deleteMany(),
    prisma.event.deleteMany(),
    prisma.review.deleteMany(),
    prisma.message.deleteMany(),
    prisma.marketplacePost.deleteMany(),
    prisma.newsAiGeneration.deleteMany(),
    prisma.news.deleteMany(),
    prisma.business.deleteMany(),
    prisma.user.deleteMany(),
    prisma.barrio.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
