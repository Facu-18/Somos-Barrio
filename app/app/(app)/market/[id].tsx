import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Linking, Alert, useWindowDimensions, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { uuidV4 } from '../../../lib/uuid';
import { useMarketplacePostActions } from '../../../hooks/useMarketplacePostActions';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayButton } from '../../../components/ClayButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const moderationReasonLabels: Record<string, string> = {
  PROHIBITED_ITEM: 'producto prohibido',
  REGULATED_ITEM: 'producto regulado',
  INAPPROPRIATE_CONTENT: 'contenido inapropiado',
  FRAUD_OR_MISLEADING: 'información engañosa',
  SPAM_OR_DUPLICATE: 'spam o contenido duplicado',
  QUARANTINED_ASSET: 'imagen por revisar',
  REPORT_THRESHOLD: 'reportes vecinales',
  OTHER_POLICY: 'política del marketplace'
};

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { toggleSold, confirmDelete, pendingPostId } = useMarketplacePostActions(barrioSlug);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportCategory, setReportCategory] = useState<string>('');
  const [reportComment, setReportComment] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const [appealModalVisible, setAppealModalVisible] = useState(false);
  const [appealStatement, setAppealStatement] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);

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

  const submitReport = async () => {
    if (!reportCategory) {
      Alert.alert('Error', 'Por favor selecciona un motivo.');
      return;
    }
    setIsReporting(true);
    try {
      await api.post(`/barrios/${barrioSlug}/marketplace/${id}/reports`, {
        category: reportCategory,
        comment: reportComment,
      });
      Alert.alert('Gracias', 'Tu reporte ha sido enviado y será revisado por los moderadores.');
      setReportModalVisible(false);
      setReportCategory('');
      setReportComment('');
      await queryClient.invalidateQueries({ queryKey: ['market', barrioSlug] });
      const refreshed = await refetch();
      if (refreshed.isError) router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo enviar el reporte.');
    } finally {
      setIsReporting(false);
    }
  };

  const submitAppeal = async () => {
    if (appealStatement.length < 20) {
      Alert.alert('Error', 'Por favor explica en más detalle (mínimo 20 caracteres) por qué tu publicación cumple con las normas.');
      return;
    }
    setIsAppealing(true);
    try {
      await api.post(`/barrios/${barrioSlug}/marketplace/${id}/appeals`, {
        statement: appealStatement,
        expectedVersion: item.moderationVersion,
        idempotencyKey: uuidV4()
      });
      Alert.alert('Apelación enviada', 'Tu apelación será revisada por el equipo de moderación.');
      setAppealModalVisible(false);
      setAppealStatement('');
      refetch();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo enviar la apelación.');
    } finally {
      setIsAppealing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>

        {user?.id !== item.user?.id && item.moderationStatus === 'APPROVED' && item.availability === 'AVAILABLE' && (
          <TouchableOpacity onPress={() => setReportModalVisible(true)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Reportar publicación">
            <MaterialCommunityIcons name="flag-outline" size={24} color={ClayTheme.colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
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
          {item.moderationStatus === 'PENDING_REVIEW' && (
             <View style={{backgroundColor: '#fef3c7', padding: 12, borderRadius: 12, marginBottom: 16}}>
               <Text style={{color: '#d97706', fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13}}>Esta publicación está pendiente de revisión por un moderador y no es visible al público.</Text>
             </View>
          )}
          {item.moderationStatus === 'REJECTED' && (
             <View style={{backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, marginBottom: 16}}>
               <Text style={{color: '#dc2626', fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13}}>Esta publicación fue rechazada por {moderationReasonLabels[item.moderationReasonCode ?? ''] ?? 'contenido no permitido'} y no es visible al público.</Text>
                {user?.id === item.user?.id && !item.currentAppeal && (
                  <TouchableOpacity onPress={() => setAppealModalVisible(true)} style={{marginTop: 8}}>
                   <Text style={{color: '#b91c1c', fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 14, textDecorationLine: 'underline'}}>Apelar decisión</Text>
                 </TouchableOpacity>
                )}
                {item.currentAppeal && <Text style={{color: '#b91c1c', marginTop: 8}}>Apelación pendiente de revisión.</Text>}
             </View>
          )}
          {item.moderationStatus === 'REMOVED' && (
             <View style={{backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, marginBottom: 16}}>
               <Text style={{color: '#dc2626', fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13}}>Esta publicación fue retirada por moderación y no es visible al público.</Text>
                {user?.id === item.user?.id && !item.currentAppeal && (
                 <TouchableOpacity onPress={() => setAppealModalVisible(true)} style={{marginTop: 8}}>
                   <Text style={{color: '#b91c1c', fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 14, textDecorationLine: 'underline'}}>Apelar decisión</Text>
                 </TouchableOpacity>
                )}
                {item.currentAppeal && <Text style={{color: '#b91c1c', marginTop: 8}}>Apelación pendiente de revisión.</Text>}
             </View>
          )}

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
          {user?.id === item.user?.id && item.moderationStatus !== 'APPROVED' && (
            <ClayButton
              title="Corregir publicación"
              onPress={() => router.push(`/(app)/create-market?postId=${item.id}`)}
              variant="secondary"
              style={{ marginTop: 16 }}
            />
          )}
          {user?.id === item.user?.id && (
            <View style={styles.ownerActions}>
              {item.availability === 'SOLD' && (
                <Text style={styles.soldNotice}>Marcaste esta publicación como vendida: no aparece en el marketplace.</Text>
              )}
              {item.moderationStatus !== 'REMOVED' && (
                <ClayButton
                  title={item.availability === 'SOLD' ? 'Volver a publicar' : 'Marcar como vendido'}
                  icon={item.availability === 'SOLD' ? 'refresh' : 'check-circle-outline'}
                  onPress={() => toggleSold(item)}
                  loading={pendingPostId === item.id}
                  disabled={pendingPostId === item.id}
                  variant="secondary"
                />
              )}
              <ClayButton
                title="Eliminar publicación"
                icon="trash-can-outline"
                onPress={() => confirmDelete(item, () => router.back())}
                disabled={pendingPostId === item.id}
                variant="destructive"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {item.moderationStatus === 'APPROVED' && item.availability === 'AVAILABLE' && user?.id !== item.user?.id && (
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
      )}

      {/* Report Modal */}
      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reportar Publicación</Text>
            <Text style={styles.modalSubtitle}>¿Por qué quieres reportar esto?</Text>

            <ScrollView style={{ maxHeight: 200, marginBottom: 15 }}>
              {[
                { id: 'FRAUD', label: 'Posible estafa o fraude' },
                { id: 'SPAM', label: 'Spam o publicación repetida' },
                { id: 'INAPPROPRIATE', label: 'Contenido inapropiado u ofensivo' },
                { id: 'WEAPONS', label: 'Venta de armas' },
                { id: 'DRUGS', label: 'Venta de drogas o medicamentos' },
                { id: 'OTHER', label: 'Otro motivo' }
              ].map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryOption, reportCategory === cat.id && styles.categoryOptionSelected]}
                  onPress={() => setReportCategory(cat.id)}
                >
                  <Text style={[styles.categoryOptionText, reportCategory === cat.id && styles.categoryOptionTextSelected]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.modalInput}
              placeholder="Detalles adicionales (opcional)..."
              value={reportComment}
              onChangeText={setReportComment}
              multiline
              maxLength={1000}
            />

            <View style={styles.modalButtons}>
              <ClayButton title="Cancelar" onPress={() => setReportModalVisible(false)} variant="secondary" style={{ flex: 1, marginRight: 8 }} />
              <ClayButton title="Enviar Reporte" onPress={submitReport} loading={isReporting} style={{ flex: 1, backgroundColor: ClayTheme.colors.error }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Appeal Modal */}
      <Modal visible={appealModalVisible} transparent animationType="slide" onRequestClose={() => setAppealModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Apelar decisión</Text>
            <Text style={styles.modalSubtitle}>Explicá por qué creés que tu publicación cumple con las normas del barrio y debe ser restaurada.</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Explica tu caso aquí..."
              value={appealStatement}
              onChangeText={setAppealStatement}
              multiline
              maxLength={2000}
            />

            <View style={styles.modalButtons}>
              <ClayButton title="Cancelar" onPress={() => setAppealModalVisible(false)} variant="secondary" style={{ flex: 1, marginRight: 8 }} />
              <ClayButton title="Enviar Apelación" onPress={submitAppeal} loading={isAppealing} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
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
  headerContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
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
  ownerActions: {
    marginTop: 16,
    gap: 10,
  },
  soldNotice: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 13,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ClayTheme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 22,
    color: ClayTheme.colors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    marginBottom: 20,
  },
  categoryOption: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: ClayTheme.colors.surface,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    borderColor: ClayTheme.colors.error,
    backgroundColor: '#fef2f2',
  },
  categoryOptionText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    color: ClayTheme.colors.text,
    fontSize: 15,
  },
  categoryOptionTextSelected: {
    color: ClayTheme.colors.error,
  },
  modalInput: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 16,
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.text,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});
