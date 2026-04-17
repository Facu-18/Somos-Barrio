import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API } from "../../test/helpers";

describe("Auth — integration", () => {
  const email    = `int_auth_${Date.now()}@test.com`;
  const password = "Password123!";

  it("POST /auth/register — crea usuario y devuelve accessToken", async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ email, password, name: "Int User" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe("VECINO");
  });

  it("POST /auth/register — rechaza email duplicado", async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ email, password, name: "Dup User" });

    expect(res.status).toBe(409);
  });

  it("POST /auth/register — falla con contraseña corta (400 validación)", async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ email: "otro@test.com", password: "corta", name: "X" });

    // Zod validation errors devuelven 400
    expect(res.status).toBe(400);
  });

  it("POST /auth/login — devuelve accessToken con credenciales correctas", async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("POST /auth/login — rechaza contraseña incorrecta", async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password: "WrongPass999!" });

    expect(res.status).toBe(401);
  });

  it("GET /auth/me — devuelve usuario autenticado", async () => {
    const loginRes = await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password });

    const token = loginRes.body.data.accessToken as string;

    const res = await request(app)
      .get(`${API}/auth/me`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // req.user tiene { id, role, jti, tokenExp }
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.role).toBe("VECINO");
  });

  it("GET /auth/me — rechaza sin token", async () => {
    const res = await request(app).get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });

  it("POST /auth/logout — devuelve 204 e invalida el token", async () => {
    const loginRes = await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password });

    const token = loginRes.body.data.accessToken as string;

    const logoutRes = await request(app)
      .post(`${API}/auth/logout`)
      .set("Authorization", `Bearer ${token}`);

    // logout devuelve 204 No Content
    expect(logoutRes.status).toBe(204);

    // El mismo token ya no debe funcionar (blacklisted en Redis)
    const meRes = await request(app)
      .get(`${API}/auth/me`)
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(401);
  });
});
