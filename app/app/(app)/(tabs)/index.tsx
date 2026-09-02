import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayCard } from '../../../components/ClayCard';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
}

export default function HomeScreen() {
  const { data: user, isLoading: isLoadingUser } = useAuth();
  
  const barrioSlug = user?.barrio?.slug || 'palermo'; // Fallback if no barrio

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
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>Últimas novedades</Text>
          <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
        </View>
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={() => router.push('/(app)/profile')}
          style={styles.profileAvatar}
        >
          <Text style={styles.profileAvatarText}>
            {user?.name?.substring(0, 2).toUpperCase() || 'XX'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {data?.map((news) => {
        const catStyle = getCategoryStyle(news.category);
        return (
          <ClayCard key={news.id}>
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
        );
      })}

      {data?.length === 0 && (
        <Text style={styles.emptyText}>Aún no hay noticias en este barrio.</Text>
      )}

    </ScrollView>
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
    paddingBottom: 100, // Space for the absolute tab bar
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
  profileAvatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 14,
    color: ClayTheme.colors.primaryText,
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
