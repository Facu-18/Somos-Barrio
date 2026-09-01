import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "./assert-test-database";

describe("assertTestDatabase", () => {
  it("acepta exclusivamente la base de integracion", () => {
    const url = "postgresql://postgres:postgres@localhost:5434/somos-barrio-test?schema=public";
    expect(assertTestDatabase(url)).toBe(url);
  });

  it.each([
    undefined,
    "not-a-url",
    "postgresql://postgres:postgres@localhost:5434/somos-barrio?schema=public",
    "postgresql://postgres:postgres@localhost:5434/postgres"
  ])("bloquea una URL insegura: %s", (url) => {
    expect(() => assertTestDatabase(url)).toThrow();
  });
});
