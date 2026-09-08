import React from 'react';
import { listPerf } from '../../../constants/ListPerf';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme } from '../../../constants/ClayTheme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState } from '../../../components/EmptyState';

interface MarketItem {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  category: string;
  images: string[];
  createdAt: string;
  user: {
    name: string;
  };
}

export default function MarketScreen() {
  const { data: user, isLoading: isLoadingUser } = useAuth();
  const barrioSlug = user!.barrio!.slug;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['market', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/marketplace?limit=20`);
      return response.data.data.items as MarketItem[];
    },
    enabled: !!user,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
  };

  const getPlaceholderStyle = (index: number) => {
    // Return different placeholder backgrounds based on index
    const styles = [
      { bg: '#E4EDF6', badgeBg: '#E1EFE2', badgeColor: '#35663A', badgeText: 'Disponible' },
      { bg: '#F4E9DC', badgeBg: '#F6EBD2', badgeColor: '#856520', badgeText: 'Reservado' },
      { bg: '#EAE7F2', badgeBg: '#E1EFE2', badgeColor: '#35663A', badgeText: 'Disponible' },
      { bg: '#E6EFE7', badgeBg: '#E1EFE2', badgeColor: '#35663A', badgeText: 'Se regala' },
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
    <View style={styles.container}>
      <FlatList
        {...listPerf}
        data={data ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.grid}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListHeaderComponent={(
          <>
            <View style={styles.headerContainer}>
              <View style={styles.header}>
                <Text style={styles.sectionTitle}>Mercado</Text>
                <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/my-posts')} style={styles.myPostsButton} accessibilityLabel="Mis publicaciones">
                <MaterialCommunityIcons name="store-cog" size={22} color={ClayTheme.colors.primaryText} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <View style={styles.searchInput} accessibilityLabel="Búsqueda de mercado no disponible">
                <MaterialCommunityIcons name="magnify" size={20} color={ClayTheme.colors.textMuted} />
                <Text style={styles.searchText}>Buscar en el mercado</Text>
              </View>
            </View>
          </>
        )}
        renderItem={({ item, index }) => {
            const pStyle = getPlaceholderStyle(index);
            const isFree = item.price === 0 || item.price === null;
            
            return (
              <TouchableOpacity 
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/(app)/market/[id]', params: { id: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${isFree ? 'Gratis' : `$ ${item.price?.toLocaleString('es-AR')}`}`}
              >
                <View style={[styles.imageContainer, { backgroundColor: pStyle.bg }]}>
                  {item.images && item.images.length > 0 ? (
                    <Image source={{ uri: item.images[0] }} style={styles.image} />
                  ) : (
                    // Placeholder geometry
                    <View style={styles.placeholderGeo} />
                  )}
                  <Text style={[styles.badge, { backgroundColor: pStyle.badgeBg, color: pStyle.badgeColor }]}>
                    {isFree ? 'Se regala' : pStyle.badgeText}
                  </Text>
                </View>
                
                <View style={styles.cardInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.itemPrice, isFree && { color: ClayTheme.colors.primaryText }]}>
                    {isFree ? 'Gratis' : `$ ${item.price?.toLocaleString('es-AR')}`}
                  </Text>
                  <Text style={styles.itemMeta}>{formatDate(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
        }}
        ListEmptyComponent={
          <EmptyState 
            iconName="storefront-outline" 
            title="Todavía nadie publicó nada" 
            description="Sé la primera persona en publicar algo." 
            actionLabel="Publicar algo" 
            onAction={() => router.push('/(app)/create-market')} 
          />
        }
      />

      {/* FAB Button */}
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => router.push('/(app)/create-market')}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Publicar producto"
      >
        <MaterialCommunityIcons name="plus" size={30} color={ClayTheme.colors.primaryText} />
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
    paddingTop: 60,
    paddingBottom: 120, // space for tab bar
    paddingHorizontal: 22,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  header: {},
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
  myPostsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ClayTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
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
  grid: {
    gap: 14,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 26,
    padding: 10,
    paddingBottom: 14,
    ...ClayTheme.shadows.elevated,
    marginBottom: 6,
  },
  imageContainer: {
    height: 112,
    borderRadius: 19,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderGeo: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 50,
    backgroundColor: ClayTheme.colors.accent,
    opacity: 0.6,
    left: -14,
    bottom: -22,
  },
  badge: {
    position: 'absolute',
    left: 9,
    top: 9,
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cardInfo: {
    paddingHorizontal: 4,
    gap: 4,
  },
  itemTitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.text,
    lineHeight: 18,
  },
  itemPrice: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 17,
    color: ClayTheme.colors.text,
  },
  itemMeta: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 11.5,
    color: ClayTheme.colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 110, // space for tab bar
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: ClayTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  }
});
