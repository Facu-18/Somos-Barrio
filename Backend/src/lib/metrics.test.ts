import { afterEach, describe, expect, it } from "vitest";
import { metrics } from "./metrics";
import { resolveRequestId, runWithRequestContext, getRequestId } from "./request-context";

afterEach(() => metrics.resetForTests());

describe("registro de métricas", () => {
  it("renderiza counters con etiquetas escapadas en formato Prometheus", () => {
    const counter = metrics.counter("test_decisions_total", "Decisiones de prueba");
    counter.inc({ domain: "FORUM", decision: "BLOCK" });
    counter.inc({ decision: "BLOCK", domain: "FORUM" }, 2);
    counter.inc({ domain: 'raro"\n' });

    const output = metrics.renderPrometheus();
    expect(output).toContain("# TYPE test_decisions_total counter");
    expect(output).toContain('test_decisions_total{decision="BLOCK",domain="FORUM"} 3');
    expect(output).toContain('test_decisions_total{domain="raro\\"\\n"} 1');
  });

  it("acumula histogramas por bucket, suma y cantidad", () => {
    const histogram = metrics.histogram("test_duration_seconds", "Latencia de prueba", [0.1, 1]);
    histogram.observe({ op: "improve" }, 0.05);
    histogram.observe({ op: "improve" }, 0.5);
    histogram.observe({ op: "improve" }, 3);

    const output = metrics.renderPrometheus();
    expect(output).toContain('test_duration_seconds_bucket{le="0.1",op="improve"} 1');
    expect(output).toContain('test_duration_seconds_bucket{le="1",op="improve"} 2');
    expect(output).toContain('test_duration_seconds_bucket{le="+Inf",op="improve"} 3');
    expect(output).toContain('test_duration_seconds_count{op="improve"} 3');
    expect(output).toContain('test_duration_seconds_sum{op="improve"} 3.55');
  });

  it("agrupa gauges de la misma familia bajo una sola cabecera", () => {
    const output = metrics.renderPrometheus([
      { name: "test_queue", help: "Cola", value: 2, labels: { domain: "FORUM" } },
      { name: "test_queue", help: "Cola", value: 5, labels: { domain: "MARKETPLACE" } }
    ]);
    expect(output.match(/# TYPE test_queue gauge/g)).toHaveLength(1);
    expect(output).toContain('test_queue{domain="FORUM"} 2');
    expect(output).toContain('test_queue{domain="MARKETPLACE"} 5');
  });

  it("cuenta eventos dentro de una ventana para alertas", () => {
    const now = Date.now();
    metrics.recordEvent("provider_429", now - 20 * 60 * 1000);
    metrics.recordEvent("provider_429", now - 5 * 60 * 1000);
    metrics.recordEvent("provider_429", now);
    expect(metrics.countEvents("provider_429", 15 * 60 * 1000, now)).toBe(2);
  });
});

describe("correlation id", () => {
  it.each([
    ["uuid", "3f1c2b8a-9d4e-4c1a-8b2f-1a2b3c4d5e6f", true],
    ["id opaco alfanumérico", "req-abc123XYZ", true],
    ["email", "vecina@barrio.com", false],
    ["salto de línea", "abc12345\ninjected", false],
    ["demasiado largo", "a".repeat(65), false],
    ["demasiado corto", "abc", false]
  ])("acepta o reemplaza un id entrante: %s", (_case, incoming, kept) => {
    const resolved = resolveRequestId(incoming);
    if (kept) expect(resolved).toBe(incoming);
    else expect(resolved).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("propaga el id a todo lo que corre dentro de la request", async () => {
    await runWithRequestContext("req-propagado-1", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getRequestId()).toBe("req-propagado-1");
    });
    expect(getRequestId()).toBeUndefined();
  });
});
