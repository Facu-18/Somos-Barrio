import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Linking, Alert, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayButton } from '../../../components/ClayButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  category: string;
  address: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  verified: boolean;
  coverImage: string | null;
  photos: string[];
  latitude: number | string | null;
  longitude: number | string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  reviews: Review[];
  ratingStats: {
    average: number;
    total: number;
  };
}

export default function BusinessDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { data: business, isLoading, isError, refetch } = useQuery({
    queryKey: ['business-detail', barrioSlug, slug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/businesses/${slug}`);
      return response.data.data as BusinessDetail;
    },
    enabled: !!slug && !!user,
  });

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleOpenLink = async (url: string) => {
    try {
      if (!await Linking.canOpenURL(url)) throw new Error('Unsupported URL');
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir', 'Revisá los datos de contacto e intentá nuevamente.');
    }
  };

  const handleWhatsApp = () => {
    if (business?.whatsapp) {
      const phone = business.whatsapp.replace(/\D/g, '');
      handleOpenLink(`https://wa.me/${phone}`);
    }
  };

  const handlePhone = () => {
    if (business?.phone) {
      handleOpenLink(`tel:${business.phone.replace(/[^\d+]/g, '')}`);
    }
  };

  const handleInstagram = () => {
    if (business?.instagram) {
      const handle = business.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
      handleOpenLink(`https://instagram.com/${encodeURIComponent(handle)}`);
    }
  };

  const handleMap = () => {
    if (!business) return;
    const latitude = Number(business.latitude);
    const longitude = Number(business.longitude);
    const query = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `${latitude},${longitude}`
      : business.address;
    handleOpenLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };

  const handleWeb = () => {
    if (business?.website) {
      // Ensure absolute URL
      const url = /^https?:\/\//i.test(business.website) ? business.website : `https://${business.website}`;
      handleOpenLink(url);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  if (isError || !business) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar el comercio.</Text>
        <ClayButton title="Reintentar" onPress={() => refetch()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const averageRating = Number(business.ratingStats?.average || 0).toFixed(1).replace('.0', '');
  const gallery = Array.from(new Set([business.coverImage, ...business.photos].filter((photo): photo is string => Boolean(photo))));
  
  // Categorias y colores (Misma logica que la card)
  let catBg = '#E1EFE2', catText = '#35663A';
  switch (business.category) {
    case 'GASTRONOMIA': catBg = '#F7E0D2'; catText = '#9A5227'; break;
    case 'SALUD': catBg = '#E2ECF6'; catText = '#3E6288'; break;
    case 'EDUCACION': catBg = '#F6EBD2'; catText = '#856520'; break;
    case 'SERVICIOS': catBg = '#EAE7F2'; catText = '#57508A'; break;
  }

  return (
    <View style={styles.container}>
      {/* Header back button overlay */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cover */}
        <View style={styles.coverContainer}>
          {gallery.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {gallery.map((photo) => (
                <Image key={photo} source={{ uri: photo }} style={[styles.coverImage, { width }]} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.placeholderCover}>
              <MaterialCommunityIcons name="storefront-outline" size={60} color={ClayTheme.colors.textMuted} />
            </View>
          )}
          
          <View style={styles.ownerAvatarBadge}>
            {business.owner.avatarUrl ? (
              <Image source={{ uri: business.owner.avatarUrl }} style={styles.ownerAvatar} />
            ) : (
              <View style={styles.ownerAvatarFallback}>
                <Text style={styles.ownerAvatarText}>{getInitials(business.owner.name)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info principal */}
        <View style={styles.mainInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{business.name}</Text>
            {business.verified && <MaterialCommunityIcons name="check-decagram" size={26} color="#5FA365" />}
          </View>
          
          <View style={styles.metaRow}>
            <Text style={[styles.categoryBadge, { backgroundColor: catBg, color: catText }]}>
              {business.category.charAt(0).toUpperCase() + business.category.slice(1).toLowerCase()}
            </Text>
            <View style={styles.ratingBadge}>
              <MaterialCommunityIcons name="star" size={16} color="#E0A93F" />
              <Text style={styles.ratingText}>
                {business.ratingStats?.total > 0 ? averageRating : 'Nuevo'}
              </Text>
              {business.ratingStats?.total > 0 && (
                <Text style={styles.reviewsCount}>({business.ratingStats.total})</Text>
              )}
            </View>
          </View>

          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={ClayTheme.colors.textMuted} />
            <Text style={styles.addressText}>{business.address}</Text>
          </View>

          <Text style={styles.ownerText}>Atendido por {business.owner.nickname || business.owner.name}</Text>

          {business.description && (
            <Text style={styles.description}>{business.description}</Text>
          )}
        </View>

        {/* Acciones rapidas */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleMap} accessibilityRole="link" accessibilityLabel="Abrir ubicación en el mapa">
            <View style={[styles.actionIconContainer, { backgroundColor: '#D97745' }]}>
              <MaterialCommunityIcons name="map-marker" size={24} color="white" />
            </View>
            <Text style={styles.actionLabel}>Mapa</Text>
          </TouchableOpacity>
          {business.whatsapp && (
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleWhatsApp} accessibilityRole="link" accessibilityLabel="Abrir WhatsApp">
              <View style={[styles.actionIconContainer, { backgroundColor: '#25D366' }]}>
                <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
              </View>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          {business.phone && (
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handlePhone} accessibilityRole="link" accessibilityLabel="Llamar al comercio">
              <View style={[styles.actionIconContainer, { backgroundColor: ClayTheme.colors.primary }]}>
                <MaterialCommunityIcons name="phone" size={24} color="white" />
              </View>
              <Text style={styles.actionLabel}>Llamar</Text>
            </TouchableOpacity>
          )}
          {business.instagram && (
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleInstagram} accessibilityRole="link" accessibilityLabel="Abrir Instagram">
              <View style={[styles.actionIconContainer, { backgroundColor: '#E1306C' }]}>
                <MaterialCommunityIcons name="instagram" size={24} color="white" />
              </View>
              <Text style={styles.actionLabel}>Instagram</Text>
            </TouchableOpacity>
          )}
          {business.website && (
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleWeb} accessibilityRole="link" accessibilityLabel="Abrir sitio web">
              <View style={[styles.actionIconContainer, { backgroundColor: ClayTheme.colors.text }]}>
                <MaterialCommunityIcons name="web" size={24} color="white" />
              </View>
              <Text style={styles.actionLabel}>Sitio web</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reseñas */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Reseñas</Text>
          
          {business.reviews.length === 0 ? (
            <Text style={styles.emptyText}>Este comercio aún no tiene reseñas. ¡Sé el primero en calificarlo!</Text>
          ) : (
            business.reviews.map(review => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    {review.user.avatarUrl ? (
                      <Image source={{ uri: review.user.avatarUrl }} style={styles.reviewerAvatar} />
                    ) : (
                      <View style={[styles.reviewerAvatar, { backgroundColor: '#EAE7F2', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 14, color: '#57508A' }}>
                          {getInitials(review.user.name)}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.reviewerName}>{review.user.nickname || review.user.name}</Text>
                      <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                    </View>
                  </View>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <MaterialCommunityIcons 
                        key={star} 
                        name="star" 
                        size={14} 
                        color={star <= review.rating ? "#E0A93F" : "#E4E4E4"} 
                      />
                    ))}
                  </View>
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  errorText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 16,
    color: ClayTheme.colors.error,
  },
  header: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  content: {
    paddingBottom: 40,
  },
  coverContainer: {
    width: '100%',
    height: 240,
    backgroundColor: ClayTheme.colors.surface,
    position: 'relative',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    ...ClayTheme.shadows.elevated,
    marginBottom: 40,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAE7F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  ownerAvatarBadge: {
    position: 'absolute',
    bottom: -35,
    right: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: ClayTheme.colors.background,
    padding: 4,
    ...ClayTheme.shadows.elevated,
  },
  ownerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  ownerAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: ClayTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerAvatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 24,
    color: ClayTheme.colors.primaryText,
  },
  mainInfo: {
    paddingHorizontal: 24,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 28,
    color: ClayTheme.colors.text,
    lineHeight: 34,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  categoryBadge: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClayTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    ...ClayTheme.shadows.sunk,
  },
  ratingText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 14,
    color: ClayTheme.colors.text,
  },
  reviewsCount: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 15,
    color: ClayTheme.colors.textInput,
    flex: 1,
  },
  ownerText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.textMuted,
  },
  description: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
    color: ClayTheme.colors.textInput,
    marginTop: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginTop: 30,
    gap: 16,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
    width: 70,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...ClayTheme.shadows.elevated,
  },
  actionLabel: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 12,
    color: ClayTheme.colors.text,
    textAlign: 'center',
  },
  reviewsSection: {
    paddingHorizontal: 24,
    marginTop: 40,
    gap: 16,
  },
  sectionTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 22,
    color: ClayTheme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  reviewCard: {
    backgroundColor: ClayTheme.colors.surface,
    padding: 16,
    borderRadius: 20,
    gap: 12,
    ...ClayTheme.shadows.elevated,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerName: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 15,
    color: ClayTheme.colors.text,
  },
  reviewDate: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontFamily: ClayTheme.typography.fontFamily.regular,
    fontSize: 14,
    color: ClayTheme.colors.textInput,
    lineHeight: 20,
  }
});
