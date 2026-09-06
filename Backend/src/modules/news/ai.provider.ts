import axios from 'axios';
import { env } from '../../config/env';

export interface NewsSummaryResult {
  summary: string;
  provider: string;
  model: string;
  generatedAt: Date;
}

export interface NewsSummaryProvider {
  summarizeNews(title: string, content: string): Promise<NewsSummaryResult>;
}

export class OpenAiNewsSummaryProvider implements NewsSummaryProvider {
  async summarizeNews(title: string, content: string): Promise<NewsSummaryResult> {
    const prompt = `Actúa como un editor local de un barrio. Resume los siguientes puntos clave de esta noticia de manera concisa (máximo 3 oraciones):\n\nTítulo: ${title}\nContenido: ${content}\n\nResumen:`;

    const response = await axios.post(
      `${env.AI_PROVIDER_URL}/chat/completions`,
      {
        model: env.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`
        },
        timeout: 30000 // 30 seconds timeout since local models might be slow
      }
    );

    const summaryText = response.data.choices?.[0]?.message?.content?.trim();

    if (!summaryText) {
      throw new Error("El modelo de IA no devolvió un resumen válido.");
    }

    return {
      summary: summaryText,
      provider: "OpenAI-Compatible",
      model: env.AI_MODEL,
      generatedAt: new Date()
    };
  }
}

export const newsSummaryProvider = new OpenAiNewsSummaryProvider();
