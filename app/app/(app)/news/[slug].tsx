import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayButton } from '../../../components/ClayButton';
import { ClayTheme, categoryLabel, categoryStyle } from '../../../constants/ClayTheme';
import { useAuth } from '../../../hooks/useAuth';
import { api } from '../../../lib/api';
import React, { useState } from 'react';

interface NewsDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  confirmVotes: number;
  disputeVotes: number;
  unsureVotes: number;
  aiSummary: { summary: string; provider: string } | null;
  author: { nickname: string | null };
}

interface NewsVote {
  id: string;
  value: 'CONFIRM' | 'DISPUTE' | 'UNSURE';
  reason: string;
  sourceUrl: string | null;
  createdAt: string;
  user: { nickname: string | null; avatarUrl: string | null };
}

export default function NewsDetailScreen() {
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user?.barrio?.slug;
  const insets = useSafeAreaInsets();
  const { data: news, isLoading, isError, refetch } = useQuery({
    queryKey: ['news-detail', barrioSlug, slug, preview],
    queryFn: async () => {
      const endpoint = preview === '1'
        ? `/barrios/${barrioSlug}/news/manage/${slug}`
        : `/barrios/${barrioSlug}/news/${slug}`;
      const response = await api.get(endpoint);
      return response.data.data as NewsDetail;
    },
    enabled: Boolean(barrioSlug && slug),
  });
  
  const { data: votesData } = useQuery({
    queryKey: ['news-votes', barrioSlug, slug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news/${slug}/votes`);
      return response.data.data.items as NewsVote[];
    },
    enabled: Boolean(barrioSlug && slug && preview !== '1'),
  });

  const queryClient = useQueryClient();
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [selectedVote, setSelectedVote] = useState<'CONFIRM' | 'DISPUTE' | 'UNSURE' | null>(null);
  const [reason, setReason] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const voteMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/barrios/${barrioSlug}/news/${slug}/vote`, {
        value: selectedVote,
        reason,
        sourceUrl: sourceUrl.trim() || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-detail', barrioSlug, slug] });
      queryClient.invalidateQueries({ queryKey: ['news-votes', barrioSlug, slug] });
      setVoteModalVisible(false);
      setReason('');
      setSourceUrl('');
      setSelectedVote(null);
      Alert.alert("Éxito", "Tu voto ha sido registrado.");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.response?.data?.message || "No se pudo registrar tu voto.");
    }
  });

  const openVoteModal = (val: 'CONFIRM' | 'DISPUTE' | 'UNSURE') => {
    setSelectedVote(val);
    setVoteModalVisible(true);
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ClayTheme.colors.primary} /></View>;
  }
  if (isError || !news) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No se pudo cargar la noticia.</Text>
        <ClayButton title="Reintentar" onPress={() => refetch()} style={styles.retry} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Noticia</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}>
        <Text style={[styles.category, { backgroundColor: categoryStyle(news.category).bg, color: categoryStyle(news.category).text }]}>{categoryLabel(news.category)}</Text>
        <Text style={styles.title}>{news.title}</Text>
        <Text style={styles.meta}>
          {news.publishedAt
            ? new Date(news.publishedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
            : news.status === 'PENDING_REVIEW' ? 'Pendiente de revisión' : 'Borrador'}
          {news.author.nickname ? ` · ${news.author.nickname}` : ''}
        </Text>
        {news.excerpt ? <Text style={styles.excerpt}>{news.excerpt}</Text> : null}
        
        {news.aiSummary && (
          <View style={styles.aiSummaryBox}>
            <View style={styles.aiSummaryHeader}>
              <MaterialCommunityIcons name="auto-fix" size={18} color={ClayTheme.categories.MUNICIPIO.text} />
              <Text style={styles.aiSummaryTitle}>Resumen destacado</Text>
            </View>
            <Text style={styles.aiSummaryText}>{news.aiSummary.summary}</Text>
          </View>
        )}

        <View style={styles.divider} />
        <Text style={styles.body}>{news.content}</Text>
        
        {news.status === 'PUBLISHED' && <View style={styles.verificationSection}>
          <Text style={styles.verificationTitle}>Verificación Comunitaria</Text>
          <Text style={styles.verificationDesc}>¿Esta información es correcta? Dejá tu voto con un fundamento.</Text>
          
          <View style={styles.voteButtonsRow}>
            <TouchableOpacity style={[styles.voteBtn, styles.voteBtnConfirm]} onPress={() => openVoteModal('CONFIRM')}>
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={ClayTheme.states.positive.text} />
              <Text style={[styles.voteBtnText, { color: ClayTheme.states.positive.text }]}>{news.confirmVotes} Confirman</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.voteBtn, styles.voteBtnDispute]} onPress={() => openVoteModal('DISPUTE')}>
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={ClayTheme.states.danger.text} />
              <Text style={[styles.voteBtnText, { color: ClayTheme.states.danger.text }]}>{news.disputeVotes} Disputan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.voteBtn, styles.voteBtnUnsure]} onPress={() => openVoteModal('UNSURE')}>
              <MaterialCommunityIcons name="help-circle-outline" size={22} color={ClayTheme.states.warning.text} />
              <Text style={[styles.voteBtnText, { color: ClayTheme.states.warning.text }]}>{news.unsureVotes} Dudan</Text>
            </TouchableOpacity>
          </View>
        </View>}
        
        {votesData && votesData.length > 0 && (
          <View style={styles.votesList}>
            <Text style={styles.votesListTitle}>Fundamentos de los vecinos</Text>
            {votesData.map(v => (
              <View key={v.id} style={styles.voteItem}>
                <View style={styles.voteItemHeader}>
                  <Text style={styles.voteItemAuthor}>{v.user.nickname || 'Vecino/a'}</Text>
                  <View style={[
                    styles.voteBadge, 
                    v.value === 'CONFIRM' ? styles.badgeConfirm : v.value === 'DISPUTE' ? styles.badgeDispute : styles.badgeUnsure
                  ]}>
                    <Text style={[
                      styles.voteBadgeText,
                      v.value === 'CONFIRM' ? styles.badgeTextConfirm : v.value === 'DISPUTE' ? styles.badgeTextDispute : styles.badgeTextUnsure
                    ]}>
                      {v.value === 'CONFIRM' ? 'CONFIRMA' : v.value === 'DISPUTE' ? 'DISPUTA' : 'DUDA'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.voteItemReason}>{v.reason}</Text>
                {v.sourceUrl && <Text style={styles.voteItemSource}>Fuente: {v.sourceUrl}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={voteModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fundamentá tu voto</Text>
            <Text style={styles.modalDesc}>Por favor, explicá por qué {selectedVote === 'CONFIRM' ? 'confirmás' : selectedVote === 'DISPUTE' ? 'disputás' : 'dudás de'} esta noticia (mínimo 10 caracteres).</Text>
            
            <TextInput
              style={styles.textInput}
              multiline
              placeholder="Escribe tu justificación aquí..."
              value={reason}
              onChangeText={setReason}
            />
            
            <TextInput
              style={[styles.textInput, { minHeight: 50 }]}
              placeholder="URL de fuente confiable (Opcional)"
              value={sourceUrl}
              onChangeText={setSourceUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setVoteModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtnSubmit, (reason.length < 10 || voteMutation.isPending) && { opacity: 0.5 }]} 
                onPress={() => voteMutation.mutate()}
                disabled={reason.length < 10 || voteMutation.isPending}
              >
                <Text style={styles.modalBtnSubmitText}>{voteMutation.isPending ? 'Enviando...' : 'Votar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: ClayTheme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 18, backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevated },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayTheme.colors.inputBg },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  headerSpacer: { width: 40 },
  content: { padding: 24, paddingTop: 34 },
  category: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: ClayTheme.borders.radiusPill, paddingHorizontal: 14, paddingVertical: 7, fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 12 },
  title: { marginTop: 18, fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 30, lineHeight: 37, color: ClayTheme.colors.text },
  meta: { marginTop: 12, fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.textMuted },
  excerpt: { marginTop: 24, fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 18, lineHeight: 27, color: ClayTheme.colors.textInput },
  divider: { height: 2, marginVertical: 26, borderRadius: 2, backgroundColor: ClayTheme.colors.inputBg },
  body: { fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 17, lineHeight: 28, color: ClayTheme.colors.text },
  error: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 16, color: ClayTheme.colors.error, textAlign: 'center' },
  retry: { marginTop: 20 },
  aiSummaryBox: { marginTop: 24, backgroundColor: ClayTheme.categories.MUNICIPIO.bg, borderRadius: ClayTheme.borders.radiusTile, padding: 18 },
  aiSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiSummaryTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 14, color: ClayTheme.categories.MUNICIPIO.text },
  aiSummaryText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 15, lineHeight: 22, color: ClayTheme.categories.MUNICIPIO.text },
  verificationSection: { marginTop: 40, padding: 20, backgroundColor: ClayTheme.colors.inputBg, borderRadius: ClayTheme.borders.radiusElevated, ...ClayTheme.shadows.sunk },
  verificationTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text, marginBottom: 4 },
  verificationDesc: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.textMuted, marginBottom: 16 },
  voteButtonsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: ClayTheme.hitSize, paddingHorizontal: 16, borderRadius: ClayTheme.borders.radiusPill },
  voteBtnConfirm: { backgroundColor: ClayTheme.states.positive.bg },
  voteBtnDispute: { backgroundColor: ClayTheme.states.danger.bg },
  voteBtnUnsure:  { backgroundColor: ClayTheme.states.warning.bg },
  voteBtnText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 14 },
  votesList: { marginTop: 30 },
  votesListTitle: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 16, color: ClayTheme.colors.text, marginBottom: 12 },
  voteItem: { backgroundColor: ClayTheme.colors.surface, padding: 16, borderRadius: ClayTheme.borders.radiusTile, marginBottom: 12, ...ClayTheme.shadows.elevated },
  voteItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  voteItemAuthor: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 14, color: ClayTheme.colors.text },
  voteBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: ClayTheme.borders.radiusPill },
  badgeConfirm: { backgroundColor: ClayTheme.states.positive.bg },
  badgeDispute: { backgroundColor: ClayTheme.states.danger.bg },
  badgeUnsure:  { backgroundColor: ClayTheme.states.warning.bg },
  voteBadgeText: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 10 },
  badgeTextConfirm: { color: ClayTheme.states.positive.text },
  badgeTextDispute: { color: ClayTheme.states.danger.text },
  badgeTextUnsure:  { color: ClayTheme.states.warning.text },
  voteItemReason: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, color: ClayTheme.colors.textInput, lineHeight: 20 },
  voteItemSource: { fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 12, color: ClayTheme.colors.primary, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: ClayTheme.colors.surface, width: '100%', borderRadius: ClayTheme.borders.radiusElevated, padding: 24, ...ClayTheme.shadows.elevated },
  modalTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 20, color: ClayTheme.colors.text, marginBottom: 8 },
  modalDesc: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, color: ClayTheme.colors.textMuted, marginBottom: 20, lineHeight: 20 },
  textInput: { backgroundColor: ClayTheme.colors.inputBg, borderRadius: ClayTheme.borders.radiusSunk, padding: 16, fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 15, color: ClayTheme.colors.textInput, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, backgroundColor: ClayTheme.colors.surfaceFlat, minHeight: ClayTheme.hitSize, borderRadius: ClayTheme.borders.radiusPill, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancelText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 15, color: ClayTheme.colors.text },
  modalBtnSubmit: { flex: 1, backgroundColor: ClayTheme.colors.primary, minHeight: ClayTheme.hitSize, borderRadius: ClayTheme.borders.radiusPill, alignItems: 'center', justifyContent: 'center', ...ClayTheme.shadows.primary },
  modalBtnSubmitText: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 15, color: ClayTheme.colors.primaryText },
});
