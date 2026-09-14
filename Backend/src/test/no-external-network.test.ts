import { describe, expect, it } from "vitest";
import axios from "axios";
import { drainBlockedHosts } from "./no-external-network";

describe("guard de red de los tests", () => {
  it("bloquea llamadas HTTP a proveedores externos y las registra", async () => {
    await expect(axios.post("https://api.sightengine.com/1.0/check.json", {}, { timeout: 2_000 }))
      .rejects.toMatchObject({ code: "ECONNREFUSED" });
    expect(drainBlockedHosts()).toEqual(["https://api.sightengine.com"]);
  });

  it("bloquea fetch a hosts externos", async () => {
    await expect(fetch("https://exp.host/--/api/v2/push/send")).rejects.toThrow("fetch failed");
    expect(drainBlockedHosts()).toEqual(["https://exp.host"]);
  });
});
