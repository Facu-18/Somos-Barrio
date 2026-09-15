import React from 'react';
import { listPerf } from '../../../constants/ListPerf';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme, categoryStyle } from '../../../constants/ClayTheme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState } from '../../../components/EmptyState';

interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  address: string;
  verified: boolean;
  coverImage: string | null;
  ratingStats: {
    average: number;
    total: number;
  };
}

export default function BusinessesScreen() {
  const { data: user, isLoading: isLoadingUser } = useAuth();
  const { listPaddingBottom } = useTabBarSpace();
  const barrioSlug = user!.barrio!.slug;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['businesses', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/businesses?limit=20`);
      return response.data.data.items as BusinessItem[];
    },
    enabled: !!user,
  });

  const getPlaceholderStyle = (index: number) => {
    const styles = [
      { bg: '#F4E9DC', geo1: '#F0A868', geo2: '#D9B45C' },
      { bg: '#E4EDF6', geo1: '#8FB8DE', geo2: '#A79FC6' },
      { bg: '#E6EFE7', geo1: '#7BC47F', geo2: '#E1EFE2' },
    ];
    return styles[index % styles.length];
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
        {...listPerf}
      style={styles.container} 
      data={data ?? []}
      keyExtractor={(business) => business.id}
      contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      ListHeaderComponent={(
        <>
          <View style={styles.header}>
            <Text style={styles.sectionTitle}>Comercios</Text>
            <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
          </View>
          <View style={styles.searchContainer}>
            <View style={styles.searchInput} accessibilityLabel="Búsqueda de comercios no disponible">
              <MaterialCommunityIcons name="magnify" size={20} color={ClayTheme.colors.textMuted} />
              <Text style={styles.searchText}>Buscar un comercio</Text>
            </View>
          </View>
        </>
      )}
      renderItem={({ item: business, index }) => {
          const catStyle = categoryStyle(business.category);
          const pStyle = getPlaceholderStyle(index);

          return (
            <TouchableOpacity
              activeOpacity={0.8} 
              style={styles.card}
              onPress={() => router.push({ pathname: '/(app)/business/[slug]', params: { slug: business.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`${business.name}, ${business.address}`}
            >
              <View style={[styles.imageContainer, { backgroundColor: pStyle.bg }]}>
                {business.coverImage ? (
                  <Image source={{ uri: business.coverImage }} style={styles.image} />
                ) : (
                  <>
                    <View style={[styles.placeholderGeo1, { backgroundColor: pStyle.geo1 }]} />
                    <View style={[styles.placeholderGeo2, { backgroundColor: pStyle.geo2 }]} />
                  </>
                )}
              </View>

              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.businessName} numberOfLines={1}>{business.name}</Text>
                  {business.verified && (
                    <MaterialCommunityIcons name="check-decagram" size={20} color="#5FA365" />
                  )}
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.categoryBadge, { backgroundColor: catStyle.bg, color: catStyle.text }]}>
                    {business.category.charAt(0).toUpperCase() + business.category.slice(1).toLowerCase()}
                  </Text>
                  
                  {business.ratingStats?.total > 0 ? (
                    <View style={styles.ratingContainer}>
                      <MaterialCommunityIcons name="star" size={16} color="#E0A93F" />
                      <Text style={styles.ratingText}>{Number(business.ratingStats?.average || 0).toFixed(1).replace('.0', '')}</Text>
                    </View>
                  ) : (
                    <View style={styles.ratingContainer}>
                      <Text style={[styles.ratingText, { color: ClayTheme.colors.textMuted }]}>Nuevo</Text>
                    </View>
                  )}
                </View>

                <View style={styles.addressRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color={ClayTheme.colors.textMuted} />
                  <Text style={styles.addressText} numberOfLines={1}>{business.address}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
      }}
      ListEmptyComponent={
        <EmptyState 
          iconName="store" 
          title="Todavía no hay comercios" 
          description="Contactate con la administración para registrar el tuyo." 
        />
      }
    />
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
    paddingTop: 60,
    paddingHorizontal: 22,
  },
  header: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 28,
    color: ClayTheme.colors.text,
  },
  subtitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.textMuted,
    marginTop: 2,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    height: 54,
    backgroundColor: ClayTheme.colors.inputBg,
    borderRadius: ClayTheme.borders.radiusSunk,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 11,
    ...ClayTheme.shadows.sunk,
  },
  searchText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
  },
  list: {
    paddingHorizontal: 22,
    gap: 16,
  },
  card: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 30,
    overflow: 'hidden',
    ...ClayTheme.shadows.elevated,
    marginBottom: 16,
  },
  imageContainer: {
    height: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderGeo1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.5,
    left: -30,
    top: 20,
  },
  placeholderGeo2: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 38,
    opacity: 0.45,
    right: 44,
    top: -32,
    transform: [{ rotate: '18deg' }],
  },
  cardContent: {
    padding: 18,
    gap: 11,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  businessName: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 22,
    color: ClayTheme.colors.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryBadge: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 11,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 14,
    color: ClayTheme.colors.text,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  addressText: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 13.5,
    color: ClayTheme.colors.textInput,
    flex: 1,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  }
});
