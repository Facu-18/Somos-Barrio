import React, { useState } from 'react';
import { listPerf } from '../../constants/ListPerf';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayCard } from '../../components/ClayCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiSuggestionField } from '../../components/AiSuggestionField';
import { AiGeneration, aiErrorCode, aiErrorMessage } from '../../lib/ai';

interface PendingNews {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  createdAt: string;
  author: {
    nickname: string | null;
  };
}


export default function NewsInboxScreen() {
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  const [rejectingNews, setRejectingNews] = useState<string | null>(null);
  const [observation, setObservation] = useState('');
  
  const [summarizingNews, setSummarizingNews] = useState<string | null>(null);
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [aiExcerptText, setAiExcerptText] = useState('');
  const [aiContentText, setAiContentText] = useState('');
  const [aiGeneration, setAiGeneration] = useState<AiGeneration | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['news-pending', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news/editorial/pending`);
      return response.data.data.items as PendingNews[];
    },
    enabled: !!user,
  });

  const closeAiModal = () => {
    setSummarizingNews(null);
    setAiGeneration(null);
    setAiSummaryText('');
    setAiExcerptText('');
    setAiContentText('');
  };

  const approveMutation = useMutation({
    // Con IA solo se manda la generación y el texto revisado: proveedor y modelo los pone el servidor.
    mutationFn: async ({ slug, aiGenerationId, summary, excerpt, content }: { slug: string; aiGenerationId?: string; summary?: string; excerpt?: string; content?: string }) => {
      await api.post(`/barrios/${barrioSlug}/news/${slug}/approve`, { aiGenerationId, summary, excerpt, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-pending', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['news', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['news-mine', barrioSlug] });
      closeAiModal();
      Alert.alert("Éxito", "La noticia ha sido publicada.");
    },
    onError: (error: any) => {
      const code = aiErrorCode(error);
      if (code === 'AI_GENERATION_STALE' || code === 'AI_GENERATION_ALREADY_APPLIED') {
        closeAiModal();
        queryClient.invalidateQueries({ queryKey: ['news-pending', barrioSlug] });
      }
      Alert.alert("Error", aiErrorMessage(error, "No se pudo aprobar la noticia."));
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ slug, observation }: { slug: string, observation: string }) => {
      await api.post(`/barrios/${barrioSlug}/news/${slug}/reject`, { observation });
    },
    onSuccess: () => {
      setRejectingNews(null);
      setObservation('');
      queryClient.invalidateQueries({ queryKey: ['news-pending', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['news-mine', barrioSlug] });
      Alert.alert("Rechazada", "La noticia fue devuelta al autor con tus observaciones.");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.response?.data?.message || "No se pudo rechazar la noticia.");
    }
  });

  const handleApprove = (slug: string) => {
    Alert.alert(
      "Aprobar Noticia",
      "¿Estás seguro de publicar esta noticia sin un resumen por IA?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Publicar", style: "default", onPress: () => approveMutation.mutate({ slug }) }
      ]
    );
  };

  const summarizeMutation = useMutation({
    mutationFn: async (slug: string) => {
      const response = await api.post(`/barrios/${barrioSlug}/news/editorial/${slug}/improve`);
      return response.data.data as AiGeneration;
    },
    onSuccess: (data) => {
      setAiGeneration(data);
      setAiSummaryText(data.suggestion.summary);
      setAiExcerptText(data.suggestion.excerpt ?? data.original.excerpt ?? '');
      setAiContentText(data.suggestion.content ?? data.original.content);
    },
    onError: (error: any) => {
      Alert.alert("Error de IA", aiErrorMessage(error, "No se pudo generar la propuesta."));
      setSummarizingNews(null);
    }
  });

  const handleSummarize = (slug: string) => {
    setSummarizingNews(slug);
    summarizeMutation.mutate(slug);
  };

  const handleApproveWithSummary = () => {
    if (!summarizingNews || !aiGeneration) return;
    const slug = summarizingNews;
    // Confirmación humana explícita: la IA puede equivocarse y lo que se publica es responsabilidad editorial.
    Alert.alert(
      "Publicar con cambios de IA",
      "Revisaste los cambios en descripción, cuerpo y resumen? Se van a publicar tal como están ahora.",
      [
        { text: "Seguir revisando", style: "cancel" },
        {
          text: "Publicar",
          onPress: () => approveMutation.mutate({
            slug,
            aiGenerationId: aiGeneration.generationId,
            summary: aiSummaryText.trim(),
            excerpt: aiExcerptText.trim(),
            content: aiContentText.trim(),
          }),
        },
      ]
    );
  };

  const handleReject = () => {
    if (!observation.trim()) {
      Alert.alert("Error", "Debes ingresar una observación para el autor.");
      return;
    }
    rejectMutation.mutate({ slug: rejectingNews!, observation });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bandeja de Revisión</Text>
      </View>

      <FlatList
        {...listPerf}
        data={data ?? []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay noticias pendientes de revisión.</Text>}
        renderItem={({ item }) => (
          <ClayCard>
            <View style={styles.cardHeader}>
              <Text style={styles.categoryText}>{item.category}</Text>
              <Text style={styles.timeAgo}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.authorText}>Por {item.author.nickname || 'Vecino/a'}</Text>
            
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => router.push({ pathname: '/(app)/news/[slug]', params: { slug: item.slug, preview: '1' } })}
              >
                <MaterialCommunityIcons name="eye-outline" size={20} color={ClayTheme.colors.text} />
                <Text style={styles.previewBtnText}>Ver Noticia</Text>
              </TouchableOpacity>
              
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={styles.rejectBtn} 
                  onPress={() => setRejectingNews(item.slug)}
                >
                  <MaterialCommunityIcons name="close" size={20} color={ClayTheme.colors.error} />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.summarizeBtn} 
                  onPress={() => handleSummarize(item.slug)}
                >
                  <MaterialCommunityIcons name="auto-fix" size={20} color={ClayTheme.categories.MUNICIPIO.text} />
                  <Text style={styles.summarizeBtnText}>Mejorar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.approveBtn} 
                  onPress={() => handleApprove(item.slug)}
                >
                  <MaterialCommunityIcons name="check" size={20} color={ClayTheme.colors.primaryText} />
                  <Text style={styles.approveBtnText}>Aprobar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ClayCard>
        )}
      />

      <Modal
        visible={!!rejectingNews}
        transparent
        animationType="fade"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView
            style={styles.aiModal}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Observaciones</Text>
            <Text style={styles.modalDesc}>Indicá al autor qué debe corregir para que la noticia sea aprobada.</Text>
            
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              placeholder="Ej: El título es muy largo, o falta información."
              value={observation}
              onChangeText={setObservation}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setRejectingNews(null); setObservation(''); }}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtnSubmit, !observation.trim() && { opacity: 0.5 }]} 
                onPress={handleReject}
                disabled={!observation.trim() || rejectMutation.isPending}
              >
                <Text style={styles.modalBtnSubmitText}>{rejectMutation.isPending ? 'Enviando...' : 'Rechazar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!summarizingNews}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView
            style={styles.aiModal}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Edición asistida por IA</Text>
            
            {summarizeMutation.isPending ? (
              <View style={styles.aiLoading}>
                <ActivityIndicator size="large" color={ClayTheme.categories.MUNICIPIO.text} />
                <Text style={styles.aiLoadingText}>Mejorando descripción, cuerpo y resumen sin cambiar los hechos...</Text>
              </View>
            ) : aiGeneration ? (
              <View>
                <Text style={styles.modalDesc}>Revisá los cambios marcados antes de publicar: en verde lo que agrega la IA y tachado lo que quita. La IA puede equivocarse y no debe agregar hechos.</Text>

                <AiSuggestionField
                  label="Descripción"
                  original={aiGeneration.original.excerpt}
                  value={aiExcerptText}
                  onChangeText={setAiExcerptText}
                  maxLength={500}
                />

                <AiSuggestionField
                  label="Cuerpo de la noticia"
                  original={aiGeneration.original.content}
                  value={aiContentText}
                  onChangeText={setAiContentText}
                  tall
                />

                <Text style={styles.inputLabel}>Resumen destacado (nuevo)</Text>
                
                <TextInput
                  style={styles.textInput}
                  multiline
                  value={aiSummaryText}
                  onChangeText={setAiSummaryText}
                />
                
                <Text style={styles.aiMeta}>Generado por {aiGeneration.provider} · {aiGeneration.model} · {aiGeneration.promptVersion}</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={closeAiModal}>
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalBtnSubmit, { backgroundColor: ClayTheme.categories.MUNICIPIO.dot }]} 
                    onPress={handleApproveWithSummary}
                    disabled={approveMutation.isPending || !aiExcerptText.trim() || aiContentText.trim().length < 10 || !aiSummaryText.trim()}
                  >
                    <Text style={styles.modalBtnSubmitText}>{approveMutation.isPending ? 'Publicando...' : 'Revisar y publicar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={closeAiModal}>
                  <Text style={styles.modalBtnCancelText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: ClayTheme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16, backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  headerTitle: { flex: 1, fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  content: { padding: 16, gap: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  categoryText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 12, color: ClayTheme.colors.primary },
  timeAgo: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 12, color: ClayTheme.colors.textMuted },
  cardTitle: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 18, color: ClayTheme.colors.text, marginBottom: 4 },
  authorText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.textMuted, marginBottom: 16 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginTop: 4 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ClayTheme.colors.inputBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  previewBtnText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.text },
  rejectBtn: { width: ClayTheme.hitSize, height: ClayTheme.hitSize, borderRadius: ClayTheme.borders.radiusPill, backgroundColor: ClayTheme.colors.errorBg, alignItems: 'center', justifyContent: 'center' },
  summarizeBtn: { minHeight: ClayTheme.hitSize, borderRadius: ClayTheme.borders.radiusPill, backgroundColor: ClayTheme.categories.MUNICIPIO.bg, paddingHorizontal: 14, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  summarizeBtnText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 12, color: ClayTheme.categories.MUNICIPIO.text },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ClayTheme.colors.primary, paddingHorizontal: 16, borderRadius: 18 },
  approveBtnText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.primaryText },
  emptyText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 15, color: ClayTheme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: ClayTheme.colors.surface, width: '100%', borderRadius: ClayTheme.borders.radiusElevated, padding: 24, ...ClayTheme.shadows.elevated },
  aiModal: { width: '100%', maxHeight: '92%', borderRadius: 24 },
  modalTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 20, color: ClayTheme.colors.text, marginBottom: 8 },
  modalDesc: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, color: ClayTheme.colors.textMuted, marginBottom: 20, lineHeight: 20 },
  textInput: { backgroundColor: ClayTheme.colors.inputBg, borderRadius: 12, padding: 16, fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 15, color: ClayTheme.colors.textInput, minHeight: 100, textAlignVertical: 'top', marginBottom: 24 },
  bodyInput: { minHeight: 180 },
  inputLabel: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.text, marginBottom: 6 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, backgroundColor: ClayTheme.colors.inputBg, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnCancelText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 15, color: ClayTheme.colors.text },
  modalBtnSubmit: { flex: 1, backgroundColor: ClayTheme.colors.error, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnSubmitText: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 15, color: ClayTheme.colors.primaryText },
  aiLoading: { padding: 40, alignItems: 'center', gap: 16 },
  aiLoadingText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, color: ClayTheme.colors.textMuted, textAlign: 'center' },
  aiMeta: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 11, color: ClayTheme.colors.textMuted, textAlign: 'right', marginBottom: 16 }
});
