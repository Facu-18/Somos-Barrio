import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

describe("Eventos — integration", () => {
  let barrioSlug: string;
  let organizerToken: string;
  let attendeeToken: string;
  let eventId: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`events-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const o = await registerAndLogin({ name: "Organizador" });
    organizerToken = o.token;
    const a = await registerAndLogin({ name: "Asistente" });
    attendeeToken = a.token;
  });

  it("GET /barrios/:slug/events — lista (paginada) al inicio", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/events`);
    expect(res.status).toBe(200);
    // La respuesta tiene { data: { items: [], total, page, limit } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("POST /barrios/:slug/events — usuario autenticado puede crear evento", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/events`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        title: "Fiesta Barrial",
        description: "Gran fiesta barrial anual",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Plaza Central",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Fiesta Barrial");
    eventId = res.body.data.id;
  });

  it("GET /barrios/:slug/events/:eventId — obtiene evento", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/events/${eventId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(eventId);
  });

  it("POST /barrios/:slug/events/:eventId/rsvp — asistente puede confirmar", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/events/${eventId}/rsvp`)
      .set("Authorization", `Bearer ${attendeeToken}`)
      .send({ status: "GOING" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("GOING");
  });

  it("POST /barrios/:slug/events/:eventId/rsvp — actualiza estado RSVP (upsert)", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/events/${eventId}/rsvp`)
      .set("Authorization", `Bearer ${attendeeToken}`)
      .send({ status: "INTERESTED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("INTERESTED");
  });

  it("DELETE /barrios/:slug/events/:eventId — organizador puede borrar", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/events/${eventId}`)
      .set("Authorization", `Bearer ${organizerToken}`);

    expect(res.status).toBe(204);
  });
});
