import request from "supertest";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { app } from "../app";

export const API = "/api/v1";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5434/somos-barrio-test?schema=public",
    },
  },
});

export async function registerAndLogin(opts?: {
  email?: string;
  password?: string;
  name?: string;
}) {
  const email    = opts?.email    ?? `user_${Date.now()}@test.com`;
  const password = opts?.password ?? "Password123!";
  const name     = opts?.name     ?? "Test User";

  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ email, password, name });

  return {
    token:  res.body.data?.accessToken as string,
    user:   res.body.data?.user,
    email,
    password,
    statusCode: res.status,
  };
}

export async function createAdminAndLogin() {
  const email    = `admin_${Date.now()}@test.com`;
  const password = "Admin1234!";

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name: "Admin Test", passwordHash: hashed, role: UserRole.ADMIN },
  });

  const res = await request(app)
    .post(`${API}/auth/login`)
    .send({ email, password });

  return {
    token: res.body.data?.accessToken as string,
    user:  res.body.data?.user,
    email,
  };
}

export async function seedBarrio(slug?: string) {
  const s = slug ?? `barrio-${Date.now()}`;
  return prisma.barrio.create({
    data: { name: "Barrio Test", slug: s, city: "Buenos Aires", province: "Buenos Aires" },
  });
}

export { prisma as testPrisma };
