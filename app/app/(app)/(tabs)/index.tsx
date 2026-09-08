import React from 'react';
import { listPerf } from '../../../constants/ListPerf';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ClayTheme, categoryLabel, categoryStyle } from '../../../constants/ClayTheme';
import { ClayCard } from '../../../components/ClayCard';
import { EmptyState } from '../../../components/EmptyState';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: user, isLoading: isLoadingUser } = useAuth();

  const barrioSlug = user!.barrio!.slug;
  const isEditor = user?.role === 'EDITOR' || user?.role === 'ADMIN';

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['news', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news?limit=10`);
      return response.data.data.items as NewsItem[];
    },
    enabled: !!user,
  });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });

  if (isLoadingUser || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  // El FAB se apoya sobre la tab bar flotante (alto 70 + su separación inferior).
  const fabBottom = Math.max(24, insets.bottom + 8) + 70 + 14;

  return (
    <View style={styles.container}>
      <FlatList
        {...listPerf}
        data={data ?? []}
        keyExtractor={(news) => news.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitles}>
                <Text style={styles.title}>Últimas novedades</Text>
                <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/(app)/profile')}
                style={styles.avatar}
                accessibilityRole="button"
                accessibilityLabel="Abrir mi perfil"
              >
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.name?.substring(0, 2).toUpperCase() || 'XX'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.chipRow}>
              <TouchableOpacity
                style={styles.chip}
                activeOpacity={0.85}
                onPress={() => router.push('/(app)/my-news')}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name="file-document-multiple-outline"
                  size={17}
                  color={ClayTheme.colors.textInput}
                />
                <Text style={styles.chipText}>Mis propuestas</Text>
              </TouchableOpacity>

              {isEditor ? (
                <TouchableOpacity
                  style={styles.chip}
                  activeOpacity={0.85}
                  onPress={() => router.push('/(app)/news-inbox')}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="inbox-outline"
                    size={17}
                    color={ClayTheme.colors.textInput}
                  />
                  <Text style={styles.chipText}>Revisión</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item: news }) => {
          const cat = categoryStyle(news.category);
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push({ pathname: '/(app)/news/[slug]', params: { slug: news.slug } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Abrir noticia ${news.title}`}
            >
              <ClayCard>
                <View style={styles.cardHeader}>
                  <Text style={[styles.badge, { backgroundColor: cat.bg, color: cat.text }]}>
                    {categoryLabel(news.category)}
                  </Text>
                  <Text style={styles.timeAgo}>{formatDate(news.publishedAt)}</Text>
                </View>
                <Text style={styles.cardTitle}>{news.title}</Text>
                {news.excerpt ? (
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {news.excerpt}
                  </Text>
                ) : null}
              </ClayCard>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            iconName="newspaper-variant-outline"
            title="Todavía no hay novedades"
            description={`Sé la primera persona en contar algo que pasa en ${user?.barrio?.name || 'tu barrio'}.`}
            actionLabel="Proponer una nota"
            onAction={() => router.push('/(app)/create-news')}
          />
        }
      />

      {/*
        El diseño saca la acción primaria del header: con el título largo y el
        avatar al lado, el botón quedaba fuera de pantalla. Va como FAB extendido.
      */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        activeOpacity={0.85}
        onPress={() => router.push('/(app)/create-news')}
        accessibilityRole="button"
        accessibilityLabel="Proponer una noticia"
      >
        <MaterialCommunityIcons name="pencil-outline" size={19} color={ClayTheme.colors.primaryText} />
        <Text style={styles.fabText}>Proponer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClayTheme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ClayTheme.colors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: ClayTheme.spacing.xl,
    paddingBottom: 170,
  },
  header: {
    marginBottom: ClayTheme.spacing.lg,
    gap: ClayTheme.spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  headerTitles: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: ClayTheme.typography.size.title,
    lineHeight: 31,
    color: ClayTheme.colors.text,
  },
  subtitle: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 13.5,
    color: ClayTheme.colors.textMuted,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ClayTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevatedSm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 15,
    color: '#2F5C34',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: ClayTheme.hitSize,
    paddingHorizontal: 17,
    borderRadius: ClayTheme.borders.radiusPill,
    backgroundColor: ClayTheme.colors.surfaceFlat,
  },
  chipText: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 14,
    color: ClayTheme.colors.textInput,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  badge: {
    overflow: 'hidden',
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: ClayTheme.typography.size.badge,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: ClayTheme.borders.radiusPill,
  },
  timeAgo: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: ClayTheme.typography.size.meta,
    color: ClayTheme.colors.textMuted,
  },
  cardTitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: ClayTheme.typography.size.cardTitle,
    color: ClayTheme.colors.text,
    lineHeight: 24,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: ClayTheme.typography.fontFamily.regular,
    fontSize: ClayTheme.typography.size.bodySm,
    color: ClayTheme.colors.textInput,
    lineHeight: 21,
  },
  fab: {
    position: 'absolute',
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 54,
    paddingHorizontal: 22,
    borderRadius: ClayTheme.borders.radiusPill,
    backgroundColor: ClayTheme.colors.primary,
    ...ClayTheme.shadows.primary,
  },
  fabText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 15,
    color: ClayTheme.colors.primaryText,
  },
});
