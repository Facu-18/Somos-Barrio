import React, { useState } from 'react';
import { listPerf } from '../../constants/ListPerf';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ClayTheme } from '../../constants/ClayTheme';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MarketplacePost } from '../../types/api';
import { useMarketplacePostActions } from '../../hooks/useMarketplacePostActions';

const moderationReasonLabels: Record<string, string> = {
  PROHIBITED_ITEM: 'producto prohibido',
  REGULATED_ITEM: 'producto regulado',
  INAPPROPRIATE_CONTENT: 'contenido inapropiado',
  FRAUD_OR_MISLEADING: 'información engañosa',
  SPAM_OR_DUPLICATE: 'spam o publicación repetida',
  QUARANTINED_ASSET: 'imagen por revisar',
  REPORT_THRESHOLD: 'reportes vecinales',
  MANUAL_REVIEW: 'decisión editorial'
};

export default function MyPostsScreen() {
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(1);
  const { toggleSold, confirmDelete, pendingPostId } = useMarketplacePostActions(barrioSlug);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['market', barrioSlug, 'me', page],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/marketplace/me?page=${page}&limit=20`);
      return response.data.data;
    }
  });

  const renderItem = ({ item }: { item: MarketplacePost }) => {
    const busy = pendingPostId === item.id;
    const canToggleSold = item.moderationStatus !== 'REMOVED';
    return (
    <View style={styles.card}>
    <TouchableOpacity
      style={styles.cardMain}
      onPress={() => router.push(`/(app)/market/${item.id}`)}
    >
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.image} />
        ) : (
          <View style={styles.noImage}>
            <MaterialCommunityIcons name="image-off-outline" size={24} color={ClayTheme.colors.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.price}>
          {item.price ? `$ ${item.price.toLocaleString('es-AR')}` : 'Gratis'}
        </Text>
        <View style={styles.metaRow}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <Text style={[
              styles.status, 
              item.availability !== 'AVAILABLE' && {color: ClayTheme.colors.textMuted}
            ]}>
              {item.availability === 'AVAILABLE' ? 'Activo' : (item.availability === 'PAUSED' ? 'Pausado' : 'Vendido')}
            </Text>
            {item.moderationStatus === 'PENDING_REVIEW' && (
              <Text style={{fontSize: 10, color: '#f59e0b', fontFamily: ClayTheme.typography.fontFamily.bold}}>(En revisión)</Text>
            )}
            {item.moderationStatus === 'REJECTED' && (
              <Text style={{fontSize: 10, color: ClayTheme.colors.error, fontFamily: ClayTheme.typography.fontFamily.bold}}>
                (Rechazado{item.moderationReasonCode ? `: ${moderationReasonLabels[item.moderationReasonCode] ?? 'contenido no permitido'}` : ''})
              </Text>
            )}
            {item.moderationStatus === 'REMOVED' && (
              <Text style={{fontSize: 10, color: ClayTheme.colors.error, fontFamily: ClayTheme.typography.fontFamily.bold}}>(Retirado)</Text>
            )}
          </View>
          <Text style={styles.date}>
            {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(item.createdAt))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
      <View style={styles.actions}>
        {canToggleSold && (
          <TouchableOpacity
            style={[styles.actionButton, busy && styles.disabled]}
            onPress={() => toggleSold(item)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={item.availability === 'SOLD' ? `Volver a publicar ${item.title}` : `Marcar ${item.title} como vendido`}
          >
            <MaterialCommunityIcons name={item.availability === 'SOLD' ? 'refresh' : 'check-circle-outline'} size={17} color={ClayTheme.states.positive.text} />
            <Text style={[styles.actionText, { color: ClayTheme.states.positive.text }]}>{item.availability === 'SOLD' ? 'Volver a publicar' : 'Vendido'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, busy && styles.disabled]}
          onPress={() => router.push(`/(app)/create-market?postId=${item.id}`)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${item.title}`}
        >
          <MaterialCommunityIcons name="pencil-outline" size={17} color={ClayTheme.colors.primaryText} />
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, busy && styles.disabled]}
          onPress={() => confirmDelete(item)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${item.title}`}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={17} color={ClayTheme.states.danger.text} />
          <Text style={[styles.actionText, { color: ClayTheme.states.danger.text }]}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Publicaciones</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        {...listPerf}
        data={data?.items || []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ClayTheme.colors.primary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="storefront-outline" size={60} color={ClayTheme.colors.inputBg} />
              <Text style={styles.emptyText}>No tenés publicaciones activas</Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => router.push('/(app)/create-market')}
              >
                <Text style={styles.createButtonText}>Publicar algo</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={data?.total > data?.limit ? (
          <View style={styles.pagination}>
            <TouchableOpacity disabled={page === 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>
              <Text style={[styles.pageAction, page === 1 && styles.disabled]}>Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.date}>Página {page}</Text>
            <TouchableOpacity disabled={page * data.limit >= data.total} onPress={() => setPage((value) => value + 1)}>
              <Text style={[styles.pageAction, page * data.limit >= data.total && styles.disabled]}>Siguiente</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClayTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 20,
    backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: ClayTheme.colors.text,
  },
  listContent: {
    padding: 22,
    gap: 16,
  },
  card: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    ...ClayTheme.shadows.elevated,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: ClayTheme.colors.inputBg,
  },
  actionText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 12,
    color: ClayTheme.colors.primaryText,
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: ClayTheme.colors.inputBg,
    marginRight: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 15,
    color: ClayTheme.colors.text,
  },
  price: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 16,
    color: ClayTheme.colors.primaryText,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 11,
    color: '#008450', // success color
  },
  date: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 11,
    color: ClayTheme.colors.textMuted,
  },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 },
  pageAction: { color: ClayTheme.colors.primaryText, fontFamily: ClayTheme.typography.fontFamily.bold },
  disabled: { opacity: 0.35 },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 16,
    color: ClayTheme.colors.textMuted,
    marginTop: 16,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: ClayTheme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  createButtonText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.primaryText,
  }
});
