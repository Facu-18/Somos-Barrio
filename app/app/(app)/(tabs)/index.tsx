import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayCard } from '../../../components/ClayCard';
import { useQuery } from '@tanstack/react-query';
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
  const { data: user, isLoading: isLoadingUser } = useAuth();
  
  const barrioSlug = user!.barrio!.slug; // Fallback if no barrio

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['news', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news?limit=10`);
      return response.data.data.items as NewsItem[];
    },
    enabled: !!user, // Only fetch when user is loaded
  });

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'SEGURIDAD': return { bg: '#F7E0D2', text: '#9A5227' };
      case 'OBRAS': return { bg: '#F6EBD2', text: '#856520' };
      case 'EVENTOS': return { bg: '#E2ECF6', text: '#3E6288' };
      case 'MUNICIPIO': return { bg: '#EAE7F2', text: '#57508A' };
      case 'COMUNIDAD': return { bg: '#E1EFE2', text: '#35663A' };
      default: return { bg: '#EAE7F2', text: '#57508A' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
  };

  if (isLoadingUser || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container} 
      data={data ?? []}
      keyExtractor={(news) => news.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListHeaderComponent={(
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.sectionTitle}>Últimas novedades</Text>
              <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(app)/profile')} style={styles.profileAvatar} accessibilityRole="button" accessibilityLabel="Abrir mi perfil">
              {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.profileAvatarImage} /> : (
                <Text style={styles.profileAvatarText}>{user?.name?.substring(0, 2).toUpperCase() || 'XX'}</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(app)/create-news')}
            >
              <MaterialCommunityIcons name="pencil-plus" size={20} color={ClayTheme.colors.primary} />
              <Text style={styles.actionButtonText}>Proponer noticia</Text>
            </TouchableOpacity>

            {(user?.role === 'EDITOR' || user?.role === 'ADMIN') && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => router.push('/(app)/news-inbox')}
              >
                <MaterialCommunityIcons name="inbox-outline" size={20} color={ClayTheme.colors.text} />
                <Text style={[styles.actionButtonText, { color: ClayTheme.colors.text }]}>Revisión</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      renderItem={({ item: news }) => {
        const catStyle = getCategoryStyle(news.category);
        return (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push({ pathname: '/(app)/news/[slug]', params: { slug: news.slug } })} accessibilityRole="button" accessibilityLabel={`Abrir noticia ${news.title}`}>
          <ClayCard>
            <View style={styles.cardHeader}>
              <Text style={[styles.categoryBadge, { backgroundColor: catStyle.bg, color: catStyle.text }]}>
                {news.category.charAt(0).toUpperCase() + news.category.slice(1).toLowerCase()}
              </Text>
              <Text style={styles.timeAgo}>{formatDate(news.publishedAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{news.title}</Text>
            <Text style={styles.cardBody} numberOfLines={3}>
              {news.excerpt || 'Sin descripción'}
            </Text>
          </ClayCard>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={<Text style={styles.emptyText}>Aún no hay noticias en este barrio.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClayTheme.colors.background,
  },
  content: {
    padding: ClayTheme.spacing.lg,
    paddingTop: ClayTheme.spacing.xl,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ClayTheme.colors.background,
  },
  header: {
    marginBottom: ClayTheme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 28,
    color: ClayTheme.colors.text,
  },
  subtitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
    marginTop: 2,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ClayTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...ClayTheme.shadows.elevated,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  profileAvatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 14,
    color: ClayTheme.colors.primaryText,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E1EFE2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: ClayTheme.colors.inputBg,
  },
  actionButtonText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ClayTheme.spacing.sm,
  },
  categoryBadge: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 11,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  timeAgo: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  cardTitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 19,
    color: ClayTheme.colors.text,
    lineHeight: 24,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: ClayTheme.typography.fontFamily.regular,
    fontSize: 14,
    color: ClayTheme.colors.textInput,
    lineHeight: 21,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  }
});
