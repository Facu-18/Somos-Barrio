import axios from 'axios';
import { env } from '../../config/env';

export interface NewsSummaryResult {
  summary: string;
  provider: string;
  model: string;
  generatedAt: Date;
}

export interface NewsEditorialDraftResult extends NewsSummaryResult {
  excerpt: string;
  content: string;
}

export interface NewsSummaryProvider {
  summarizeNews(title: string, content: string): Promise<NewsSummaryResult>;
  improveNews(title: string, excerpt: string | null, content: string): Promise<NewsEditorialDraftResult>;
}

export class OpenAiNewsSummaryProvider implements NewsSummaryProvider {
  private async complete(prompt: string, maxTokens: number): Promise<string> {
    const baseUrl = env.AI_PROVIDER_URL.replace(/\/$/, '');
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: env.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: maxTokens,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`
        },
        timeout: 60000
      }
    );

    const text = response.data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("El modelo de IA no devolvió contenido válido.");
    return text;
  }

  async summarizeNews(title: string, content: string): Promise<NewsSummaryResult> {
    const prompt = `Actúa como un editor local de un barrio. Resume los siguientes puntos clave de esta noticia de manera concisa (máximo 3 oraciones):\n\nTítulo: ${title}\nContenido: ${content}\n\nResumen:`;
    const summaryText = await this.complete(prompt, 180);

    return {
      summary: summaryText,
      provider: "OpenAI-Compatible",
      model: env.AI_MODEL,
      generatedAt: new Date()
    };
  }

  async improveNews(title: string, excerpt: string | null, content: string): Promise<NewsEditorialDraftResult> {
    const prompt = `Actúa como editor de noticias barriales. Corrige ortografía, claridad y estructura sin agregar, inferir ni cambiar hechos. Conserva nombres, fechas, direcciones y datos del texto original. Devuelve solamente JSON válido, sin Markdown, con esta forma exacta: {"excerpt":"descripción breve de hasta 500 caracteres","content":"cuerpo mejorado completo","summary":"resumen destacado de máximo 3 oraciones"}.\n\nTítulo: ${title}\nDescripción actual: ${excerpt || 'Sin descripción'}\nCuerpo actual: ${content}`;
    const raw = await this.complete(prompt, 1400);
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("El modelo de IA no devolvió el formato editorial esperado.");
    }

    if (
      !parsed || typeof parsed !== 'object'
      || typeof (parsed as Record<string, unknown>).excerpt !== 'string'
      || typeof (parsed as Record<string, unknown>).content !== 'string'
      || typeof (parsed as Record<string, unknown>).summary !== 'string'
    ) {
      throw new Error("El modelo de IA devolvió una respuesta editorial incompleta.");
    }

    const result = parsed as { excerpt: string; content: string; summary: string };
    if (!result.excerpt.trim() || result.excerpt.length > 500 || result.content.trim().length < 10 || !result.summary.trim()) {
      throw new Error("La propuesta editorial generada por IA no cumple los límites requeridos.");
    }

    return {
      excerpt: result.excerpt.trim(),
      content: result.content.trim(),
      summary: result.summary.trim(),
      provider: "OpenAI-Compatible",
      model: env.AI_MODEL,
      generatedAt: new Date()
    };
  }
}

export const newsSummaryProvider = new OpenAiNewsSummaryProvider();
