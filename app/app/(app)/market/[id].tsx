import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayButton } from '../../../components/ClayButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;

  const { data: item, isLoading } = useQuery({
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

  if (!item) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Producto no encontrado</Text>
        <ClayButton title="Volver" onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const handleContact = () => {
    if (item.whatsapp) {
      Linking.openURL(`whatsapp://send?phone=${item.whatsapp}&text=Hola, vi tu publicación "${item.title}" en Somos Barrio.`);
    } else {
      alert('El vendedor no incluyó WhatsApp. El chat interno está en desarrollo.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageContainer}>
          {item.images && item.images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageCarousel}>
              {item.images.map((img: string, index: number) => (
                <Image key={index} source={{ uri: img }} style={styles.image} />
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

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.contactBtn, !item.whatsapp && { backgroundColor: ClayTheme.colors.primary }]} 
          activeOpacity={0.8} 
          onPress={handleContact}
        >
          {item.whatsapp ? (
            <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
          ) : (
            <MaterialCommunityIcons name="message-text" size={24} color="white" />
          )}
          <Text style={styles.contactBtnText}>
            {item.whatsapp ? 'Contactar por WhatsApp' : 'Contactar al vendedor'}
          </Text>
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
    top: 50,
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
    width: 400, // Should be Dimensions.get('window').width ideally, but this works for demo
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
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  contactBtn: {
    backgroundColor: '#25D366', // WhatsApp color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 24,
    gap: 10,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  contactBtnText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: 'white',
  }
});
