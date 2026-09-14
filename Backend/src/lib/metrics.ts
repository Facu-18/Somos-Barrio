/**
 * Registro de métricas en proceso con salida en formato de texto de Prometheus.
 * Sin dependencias: counters, histogramas y ventanas de eventos recientes para alertas.
 * Los valores son por instancia; con varias instancias se agregan en Prometheus.
 * Las etiquetas nunca llevan datos personales ni contenido: solo códigos de baja cardinalidad.
 */

type Labels = Record<string, string>;

export type GaugeSample = { name: string; help: string; value: number; labels?: Labels };

const DEFAULT_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];
const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000;

const labelKey = (labels: Labels) =>
  Object.keys(labels).sort().map((key) => `${key}=${labels[key]}`).join(",");

const escapeLabel = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const formatLabels = (labels: Labels, extra: Labels = {}) => {
  const merged = { ...labels, ...extra };
  const keys = Object.keys(merged).sort();
  return keys.length ? `{${keys.map((key) => `${key}="${escapeLabel(merged[key])}"`).join(",")}}` : "";
};

class Counter {
  private readonly values = new Map<string, { labels: Labels; value: number }>();
  constructor(readonly name: string, readonly help: string) {}

  inc(labels: Labels = {}, value = 1) {
    const key = labelKey(labels);
    const current = this.values.get(key);
    if (current) current.value += value;
    else this.values.set(key, { labels, value });
  }

  get(labels: Labels = {}) {
    return this.values.get(labelKey(labels))?.value ?? 0;
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { labels, value } of this.values.values()) lines.push(`${this.name}${formatLabels(labels)} ${value}`);
    return lines.join("\n");
  }

  reset() {
    this.values.clear();
  }
}

class Histogram {
  private readonly series = new Map<string, { labels: Labels; counts: number[]; sum: number; count: number }>();
  constructor(readonly name: string, readonly help: string, private readonly buckets = DEFAULT_BUCKETS) {}

  observe(labels: Labels, value: number) {
    const key = labelKey(labels);
    let entry = this.series.get(key);
    if (!entry) {
      entry = { labels, counts: this.buckets.map(() => 0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    this.buckets.forEach((bucket, index) => {
      if (value <= bucket) entry!.counts[index] += 1;
    });
    entry.sum += value;
    entry.count += 1;
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const { labels, counts, sum, count } of this.series.values()) {
      this.buckets.forEach((bucket, index) => lines.push(`${this.name}_bucket${formatLabels(labels, { le: String(bucket) })} ${counts[index]}`));
      lines.push(`${this.name}_bucket${formatLabels(labels, { le: "+Inf" })} ${count}`);
      lines.push(`${this.name}_sum${formatLabels(labels)} ${Number(sum.toFixed(6))}`);
      lines.push(`${this.name}_count${formatLabels(labels)} ${count}`);
    }
    return lines.join("\n");
  }

  reset() {
    this.series.clear();
  }
}

class Registry {
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();
  // Timestamps de eventos relevantes para alertas por ventana (p. ej. 429 del proveedor en 15 minutos).
  private readonly events = new Map<string, number[]>();

  counter(name: string, help: string) {
    if (!this.counters.has(name)) this.counters.set(name, new Counter(name, help));
    return this.counters.get(name)!;
  }

  histogram(name: string, help: string, buckets?: number[]) {
    if (!this.histograms.has(name)) this.histograms.set(name, new Histogram(name, help, buckets));
    return this.histograms.get(name)!;
  }

  recordEvent(name: string, at = Date.now()) {
    const list = this.events.get(name) ?? [];
    list.push(at);
    const cutoff = at - EVENT_RETENTION_MS;
    while (list.length && list[0] < cutoff) list.shift();
    this.events.set(name, list);
  }

  countEvents(name: string, windowMs: number, now = Date.now()) {
    const since = now - windowMs;
    return (this.events.get(name) ?? []).filter((at) => at >= since).length;
  }

  renderPrometheus(gauges: GaugeSample[] = []) {
    // Una sola cabecera HELP/TYPE por familia, aunque tenga varias series con distintas etiquetas.
    const families = new Map<string, GaugeSample[]>();
    for (const gauge of gauges) families.set(gauge.name, [...(families.get(gauge.name) ?? []), gauge]);
    const blocks = [
      ...[...this.counters.values()].map((counter) => counter.render()),
      ...[...this.histograms.values()].map((histogram) => histogram.render()),
      ...[...families.values()].map((samples) => [
        `# HELP ${samples[0].name} ${samples[0].help}`,
        `# TYPE ${samples[0].name} gauge`,
        ...samples.map((sample) => `${sample.name}${formatLabels(sample.labels ?? {})} ${sample.value}`)
      ].join("\n"))
    ];
    return `${blocks.join("\n")}\n`;
  }

  resetForTests() {
    this.counters.forEach((counter) => counter.reset());
    this.histograms.forEach((histogram) => histogram.reset());
    this.events.clear();
  }
}

export const metrics = new Registry();

// Catálogo de métricas: declarado en un solo lugar para documentar nombres y etiquetas.
export const moderationMetrics = {
  automatedDecisions: metrics.counter("moderation_automated_decisions_total", "Decisiones automáticas de la política de contenido por dominio y resultado (ALLOW, REVIEW, BLOCK)"),
  shadowMatches: metrics.counter("moderation_shadow_rule_matches_total", "Coincidencias de reglas en shadow mode que no afectaron la decisión"),
  manualDecisions: metrics.counter("moderation_manual_decisions_total", "Decisiones humanas de moderación por dominio y acción"),
  reports: metrics.counter("moderation_reports_total", "Reportes de usuarios por dominio"),
  promptInjectionRejected: metrics.counter("ai_prompt_injection_rejected_total", "Entradas rechazadas por el detector de prompt injection"),
  aiInputTooLarge: metrics.counter("ai_input_too_large_total", "Entradas rechazadas por superar los límites de la asistencia de IA")
};

export const aiMetrics = {
  providerRequests: metrics.counter("ai_provider_requests_total", "Llamadas al proveedor de IA por operación y resultado"),
  providerDuration: metrics.histogram("ai_provider_duration_seconds", "Latencia de las llamadas al proveedor de IA"),
  tokens: metrics.counter("ai_tokens_total", "Tokens informados por el proveedor por tipo"),
  estimatedCostUsd: metrics.counter("ai_estimated_cost_usd_total", "Costo estimado de las generaciones de IA en USD"),
  cacheHits: metrics.counter("ai_cache_hits_total", "Generaciones servidas desde la caché sin consumir cuota"),
  limitRejections: metrics.counter("ai_limit_rejections_total", "Pedidos rechazados por cuota, lock, presupuesto, concurrencia o apagado"),
  generations: metrics.counter("ai_generations_total", "Generaciones que consumieron una reserva")
};

export const imageModerationMetrics = {
  requests: metrics.counter("sightengine_requests_total", "Escaneos de imágenes por resultado"),
  duration: metrics.histogram("sightengine_duration_seconds", "Latencia de los escaneos de imágenes")
};

export const METRIC_EVENTS = {
  aiProviderRateLimited: "ai_provider_rate_limited",
  automatedBlock: "moderation_automated_block"
} as const;
