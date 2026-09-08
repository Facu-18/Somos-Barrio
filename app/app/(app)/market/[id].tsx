import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Linking, Alert, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayButton } from '../../../components/ClayButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { data: item, isLoading, isError, refetch } = useQuery({
    queryKey: ['market-detail', barrioSlug, id],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/marketplace/${id}`);
      return response.data.data;
    },
    enabled: !!id && !!user,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isFree = item?.price === 0 || item?.price === null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  if (isError || !item) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar la publicación.</Text>
        <ClayButton title="Reintentar" onPress={() => refetch()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const handleContact = async () => {
    const phone = String(item.whatsapp ?? '').replace(/\D/g, '');
    if (!phone) return;
    const message = encodeURIComponent(`Hola, vi tu publicación "${item.title}" en Somos Barrio.`);
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${message}`);
    } catch {
      Alert.alert('No se pudo abrir WhatsApp', 'Verificá que WhatsApp esté disponible e intentá nuevamente.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageContainer}>
          {item.images && item.images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageCarousel}>
              {item.images.map((img: string, index: number) => (
                <Image key={img} source={{ uri: img }} style={[styles.image, { width }]} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.placeholderImage}>
              <MaterialCommunityIcons name="image-off-outline" size={60} color={ClayTheme.colors.textMuted} />
              <Text style={styles.placeholderText}>Sin imágenes</Text>
            </View>
          )}
          
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={[styles.price, isFree && { color: ClayTheme.colors.primaryText }]}>
            {isFree ? 'Gratis' : `$ ${item.price?.toLocaleString('es-AR')}`}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="calendar" size={16} color={ClayTheme.colors.textMuted} />
              <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              {item.user?.avatarUrl ? (
                <Image source={{ uri: item.user.avatarUrl }} style={{ width: 20, height: 20, borderRadius: 10 }} />
              ) : (
                <MaterialCommunityIcons name="account" size={16} color={ClayTheme.colors.textMuted} />
              )}
              <Text style={styles.metaText}>{item.user?.nickname || item.user?.name}</Text>
            </View>
          </View>

          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Descripción</Text>
            <Text style={styles.descriptionText}>{item.description}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity 
          style={styles.contactBtn}
          activeOpacity={0.8} 
          onPress={handleContact}
          accessibilityRole="link"
          accessibilityLabel="Contactar por WhatsApp"
        >
          <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
          <Text style={styles.contactBtnText}>Contactar por WhatsApp</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 100,
  },
  imageContainer: {
    width: '100%',
    height: 350,
    backgroundColor: ClayTheme.colors.surface,
    position: 'relative',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    ...ClayTheme.shadows.elevated,
  },
  imageCarousel: {
    flex: 1,
  },
  image: {
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAE7F2',
  },
  placeholderText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    color: ClayTheme.colors.textMuted,
    marginTop: 10,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: ClayTheme.colors.inputBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    ...ClayTheme.shadows.elevated,
  },
  categoryText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 12,
    color: ClayTheme.colors.text,
  },
  detailsContainer: {
    padding: 24,
  },
  title: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 26,
    color: ClayTheme.colors.text,
    lineHeight: 32,
    marginBottom: 8,
  },
  price: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 28,
    color: ClayTheme.colors.text,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
  },
  descriptionCard: {
    backgroundColor: ClayTheme.colors.surface,
    padding: 20,
    borderRadius: 24,
    ...ClayTheme.shadows.elevated,
  },
  descriptionTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: ClayTheme.colors.text,
    marginBottom: 10,
  },
  descriptionText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textInput,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 24,
    paddingBottom: 34,
    backgroundColor: ClayTheme.colors.background,
    marginTop: 4,
  },
  contactBtn: {
    backgroundColor: '#25D366', // WhatsApp color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 24,
    gap: 10,
    ...ClayTheme.shadows.whatsapp,
  },
  contactBtnText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: 'white',
  }
});
