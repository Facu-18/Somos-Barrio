import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ApiResponse, User } from '../types/api';

export const useAuth = () => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }): Promise<User> => {
      const { data } = await api.get<ApiResponse<User>>('/auth/me', { signal });
      return data.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
