import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export type SightengineScores = {
  nudity: number;
  sexual: number;
  violence: number;
  gore: number;
  weapons: number;
  drugs: number;
  alcohol: number;
  tobacco: number;
  offensiveSymbols: number;
};

export type SightengineScan = {
  provider: "sightengine";
  requestId?: string;
  scores: SightengineScores;
  ocrText: string;
};

export class SightengineProviderError extends Error {
  constructor(
    public readonly statusCode: 429 | 502 | 503 | 504,
    public readonly code: string,
    public readonly requestId?: string
  ) {
    super(code);
  }
}

const probability = z.number().min(0).max(1);
const responseSchema = z.object({
  status: z.literal("success"),
  request: z.object({ id: z.string().optional() }).optional(),
  nudity: z.object({
    sexual_activity: probability,
    sexual_display: probability,
    erotica: probability,
    very_suggestive: probability,
    suggestive: probability,
    mildly_suggestive: probability
  }),
  weapon: z.object({ classes: z.object({
    firearm: probability, firearm_gesture: probability, firearm_toy: probability, knife: probability
  }) }),
  recreational_drug: z.object({ prob: probability }),
  medical: z.object({ prob: probability }),
  alcohol: z.object({ prob: probability }),
  tobacco: z.object({ prob: probability }),
  violence: z.object({ prob: probability }),
  offensive: z.object({
    nazi: probability,
    asian_swastika: probability,
    confederate: probability,
    supremacist: probability,
    terrorist: probability,
    middle_finger: probability
  }),
  gore: z.object({ prob: probability }),
  text: z.object({ content: z.string() })
});

export class SightengineProvider {
  constructor(private readonly client: AxiosInstance = axios) {}

  async scan(buffer: Buffer, mimeType: string, filename: string): Promise<SightengineScan> {
    if (!env.SIGHTENGINE_ENABLED || !env.SIGHTENGINE_API_USER || !env.SIGHTENGINE_API_SECRET) {
      if (!env.SIGHTENGINE_ENABLED) {
        logger.info("Sightengine está desactivado. Devolviendo escaneo de prueba (seguro).");
        return {
          provider: "sightengine",
          requestId: "mock-request-id",
          scores: {
            nudity: 0,
            sexual: 0,
            violence: 0,
            gore: 0,
            weapons: 0,
            drugs: 0,
            alcohol: 0,
            tobacco: 0,
            offensiveSymbols: 0
          },
          ocrText: ""
        };
      }
      throw new SightengineProviderError(503, "PROVIDER_NOT_CONFIGURED");
    }

    const startedAt = Date.now();
    try {
      const formData = new FormData();
      formData.append("media", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
      formData.append("models", "nudity-2.1,gore-2.0,weapon,alcohol,recreational_drug,medical,offensive-2.0,tobacco,violence,ocr");
      formData.append("api_user", env.SIGHTENGINE_API_USER);
      formData.append("api_secret", env.SIGHTENGINE_API_SECRET);

      const response = await this.client.post("https://api.sightengine.com/1.0/check.json", formData, {
        headers: { Accept: "application/json" },
        timeout: env.SIGHTENGINE_TIMEOUT_MS
      });
      const parsed = responseSchema.safeParse(response.data);
      if (!parsed.success) {
        const requestId = typeof response.headers?.["x-request-id"] === "string" ? response.headers["x-request-id"] : undefined;
        logger.warn({ provider: "sightengine", transportStatus: response.status, durationMs: Date.now() - startedAt }, "Respuesta inválida del proveedor de imágenes");
        throw new SightengineProviderError(502, "PROVIDER_INVALID_RESPONSE", requestId);
      }

      const data = parsed.data;
      const sexual = Math.max(data.nudity.sexual_activity, data.nudity.sexual_display, data.nudity.erotica);
      // Sightengine exposes no aggregate "nudity" score. Suggestive intensity
      // fields are mapped independently from explicit sexual-content fields.
      const nudity = Math.max(data.nudity.very_suggestive, data.nudity.suggestive, data.nudity.mildly_suggestive);
      return {
        provider: "sightengine",
        requestId: data.request?.id ?? (typeof response.headers?.["x-request-id"] === "string" ? response.headers["x-request-id"] : undefined),
        scores: {
          nudity,
          sexual,
          violence: data.violence.prob,
          gore: data.gore.prob,
          weapons: Math.max(...Object.values(data.weapon.classes)),
          drugs: Math.max(data.recreational_drug.prob, data.medical.prob),
          alcohol: data.alcohol.prob,
          tobacco: data.tobacco.prob,
          offensiveSymbols: Math.max(...Object.values(data.offensive))
        },
        ocrText: data.text.content
      };
    } catch (error: unknown) {
      if (error instanceof SightengineProviderError) throw error;
      const timeout = axios.isAxiosError(error) && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT");
      const upstreamRateLimited = axios.isAxiosError(error) && error.response?.status === 429;
      const statusCode = timeout ? 504 : upstreamRateLimited ? 429 : 502;
      logger.warn({
        provider: "sightengine",
        transportCode: axios.isAxiosError(error) ? error.code : undefined,
        transportStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
        durationMs: Date.now() - startedAt
      }, "Falló el proveedor de imágenes");
      const requestId = axios.isAxiosError(error) && typeof error.response?.headers?.["x-request-id"] === "string"
        ? error.response.headers["x-request-id"]
        : undefined;
      throw new SightengineProviderError(statusCode, timeout ? "PROVIDER_TIMEOUT" : upstreamRateLimited ? "PROVIDER_RATE_LIMITED" : "PROVIDER_UNAVAILABLE", requestId);
    }
  }
}

export const sightengineProvider = new SightengineProvider();
