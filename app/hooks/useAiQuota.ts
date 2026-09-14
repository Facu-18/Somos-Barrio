import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AiQuotaStatus {
  enabled: boolean;
  dailyLimit: number;
  used: number;
  remaining: number;
  resetsAt: string;
  requestInProgress: boolean;
}

export const aiQuotaKey = (barrioSlug: string) => ['ai-quota', barrioSlug] as const;

export function useAiQuota(barrioSlug: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: aiQuotaKey(barrioSlug),
    queryFn: async () => (await api.get(`/barrios/${barrioSlug}/news/ai/quota`)).data.data as AiQuotaStatus,
    staleTime: 30_000,
  });

  const quota = query.data;
  return {
    quota,
    isLoading: query.isLoading,
    // Sin cuota confirmada no se habilita el botón: el backend igual vuelve a validar.
    canRequest: !!quota && quota.enabled && quota.remaining > 0 && !quota.requestInProgress,
    refresh: () => queryClient.invalidateQueries({ queryKey: aiQuotaKey(barrioSlug) }),
  };
}
