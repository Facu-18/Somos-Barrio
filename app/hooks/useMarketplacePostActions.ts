import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MarketplacePost } from '../types/api';

type PostRef = Pick<MarketplacePost, 'id' | 'title' | 'availability' | 'moderationVersion'>;

const errorMessage = (error: any, fallback: string) =>
  error?.response?.status === 409
    ? 'La publicación cambió mientras tanto. Actualizá la pantalla e intentá de nuevo.'
    : error?.response?.data?.message || fallback;

/**
 * Acciones del dueño sobre sus publicaciones: marcar como vendida (o volver a publicarla) y eliminarla.
 * Cambiar la disponibilidad no reabre la moderación; eliminar es un borrado lógico en el backend.
 */
export function useMarketplacePostActions(barrioSlug: string) {
  const queryClient = useQueryClient();

  const refresh = (postId: string) => {
    // ['market', barrio] cubre el listado público, "Mis publicaciones" y el formulario de edición.
    queryClient.invalidateQueries({ queryKey: ['market', barrioSlug] });
    queryClient.invalidateQueries({ queryKey: ['market-detail', barrioSlug, postId] });
  };

  const availabilityMutation = useMutation({
    mutationFn: async ({ post, availability }: { post: PostRef; availability: MarketplacePost['availability'] }) => {
      await api.patch(`/barrios/${barrioSlug}/marketplace/${post.id}`, {
        availability,
        expectedVersion: post.moderationVersion,
      });
    },
    onSuccess: (_, { post }) => refresh(post.id),
    onError: (error, { post }) => {
      refresh(post.id);
      Alert.alert('No se pudo actualizar', errorMessage(error, 'Intentá nuevamente en unos minutos.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ post }: { post: PostRef; onDeleted?: () => void }) => {
      await api.delete(`/barrios/${barrioSlug}/marketplace/${post.id}`);
    },
    onSuccess: (_, { post, onDeleted }) => {
      refresh(post.id);
      onDeleted?.();
    },
    onError: (error, { post }) => {
      refresh(post.id);
      Alert.alert('No se pudo eliminar', errorMessage(error, 'Intentá nuevamente en unos minutos.'));
    },
  });

  const toggleSold = (post: PostRef) => {
    if (post.availability === 'SOLD') {
      availabilityMutation.mutate({ post, availability: 'AVAILABLE' });
      return;
    }
    Alert.alert(
      'Marcar como vendido',
      `"${post.title}" dejará de aparecer en el marketplace. Podés volver a publicarlo cuando quieras.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Marcar vendido', onPress: () => availabilityMutation.mutate({ post, availability: 'SOLD' }) },
      ]
    );
  };

  const confirmDelete = (post: PostRef, onDeleted?: () => void) => {
    Alert.alert(
      'Eliminar publicación',
      `¿Querés eliminar "${post.title}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate({ post, onDeleted }) },
      ]
    );
  };

  return {
    toggleSold,
    confirmDelete,
    // Id de la publicación con una acción en curso, para deshabilitar solo sus botones.
    pendingPostId: availabilityMutation.isPending
      ? availabilityMutation.variables?.post.id
      : deleteMutation.isPending ? deleteMutation.variables?.post.id : undefined,
  };
}
