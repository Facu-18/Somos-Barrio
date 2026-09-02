import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  barrioSlug?: string;
  barrio?: {
    slug: string;
    name: string;
  }
}

export const useAuth = () => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async (): Promise<User> => {
      const { data } = await api.get('/auth/me');
      return data.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
