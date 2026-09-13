import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ClayInput } from '../../components/ClayInput';
import { api } from '../../lib/api';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiSuggestionField } from '../../components/AiSuggestionField';
import { AiGeneration, aiErrorMessage } from '../../lib/ai';

const newsSchema = z.object({
  title: z.string().min(3, 'El título es muy corto').max(255),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
  category: z.enum(['SEGURIDAD', 'OBRAS', 'EVENTOS', 'MUNICIPIO', 'COMUNIDAD']),
});

type NewsForm = z.infer<typeof newsSchema>;
type AssistReview = { generation: AiGeneration; sent: Pick<NewsForm, 'title' | 'excerpt' | 'content'> };

const categories = [
  { label: 'Seguridad', value: 'SEGURIDAD' },
  { label: 'Obras', value: 'OBRAS' },
  { label: 'Eventos', value: 'EVENTOS' },
  { label: 'Municipio', value: 'MUNICIPIO' },
  { label: 'Comunidad', value: 'COMUNIDAD' },
];

const generateSlug = (title: string) => {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.floor(Math.random() * 1000);
};

export default function CreateNewsScreen() {
  const { slug: existingSlug } = useLocalSearchParams<{ slug?: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');
  const insets = useSafeAreaInsets();

  const { data: newsToEdit, isLoading: isLoadingNews } = useQuery({
    queryKey: ['news-manage', barrioSlug, existingSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news/manage/${existingSlug}`);
      return response.data.data;
    },
    enabled: !!existingSlug,
  });

  const [assistReview, setAssistReview] = useState<AssistReview | null>(null);
  const [assistExcerpt, setAssistExcerpt] = useState('');
  const [assistContent, setAssistContent] = useState('');

  const { control, handleSubmit, setValue, getValues, watch, reset, formState: { errors } } = useForm<NewsForm>({
    resolver: zodResolver(newsSchema),
    defaultValues: { title: '', excerpt: '', content: '', category: 'COMUNIDAD' }
  });

  React.useEffect(() => {
    if (newsToEdit) {
      reset({
        title: newsToEdit.title,
        excerpt: newsToEdit.excerpt || '',
        content: newsToEdit.content,
        category: newsToEdit.category,
      });
    }
  }, [newsToEdit, reset]);

  const selectedCategory = watch('category');
  const currentTitle = watch('title');
  const currentContent = watch('content');

  const improveMutation = useMutation({
    mutationFn: async (data: NewsForm) => {
      const sent = { title: data.title, excerpt: data.excerpt, content: data.content };
      const response = await api.post(`/barrios/${barrioSlug}/news/assist`, sent);
      return { generation: response.data.data as AiGeneration, sent };
    },
    // La sugerencia nunca reemplaza el formulario sola: se revisa el diff y se confirma.
    onSuccess: (review) => {
      setAssistReview(review);
      setAssistExcerpt(review.generation.suggestion.excerpt ?? review.sent.excerpt ?? '');
      setAssistContent(review.generation.suggestion.content ?? review.sent.content);
    },
    onError: (error: any) => {
      Alert.alert('No se pudo mejorar', aiErrorMessage(error, 'No se pudo conectar con el modelo de IA.'));
    },
  });

  const closeAssistReview = () => {
    setAssistReview(null);
    setAssistExcerpt('');
    setAssistContent('');
  };

  const applyAssistReview = () => {
    if (!assistReview) return;
    const current = getValues();
    const { sent } = assistReview;
    // Si el borrador cambió mientras la IA trabajaba, aplicar pisaría esas ediciones.
    const stale = current.title !== sent.title || (current.excerpt ?? '') !== (sent.excerpt ?? '') || current.content !== sent.content;
    if (stale) {
      closeAssistReview();
      Alert.alert('Sugerencia desactualizada', 'Editaste el borrador mientras se generaba la sugerencia. Volvé a pedir la mejora para no perder tus cambios.');
      return;
    }
    setValue('excerpt', assistExcerpt.trim(), { shouldDirty: true, shouldValidate: true });
    setValue('content', assistContent.trim(), { shouldDirty: true, shouldValidate: true });
    closeAssistReview();
  };

  const improveWithAi = handleSubmit((data) => improveMutation.mutate(data));

  const createMutation = useMutation({
    mutationFn: async (data: NewsForm) => {
      const payload = {
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        slug: existingSlug ? undefined : generateSlug(data.title),
        status: 'PENDING_REVIEW',
      };

      const response = existingSlug
        ? await api.patch(`/barrios/${barrioSlug}/news/${existingSlug}`, payload)
        : await api.post(`/barrios/${barrioSlug}/news`, payload);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-mine', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['news-pending', barrioSlug] });
      Alert.alert("Éxito", "La noticia fue enviada a revisión y pronto será revisada por un editor.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    },
    onError: (error: any) => {
      setGlobalError(error.response?.data?.message || 'Error al proponer la noticia.');
    }
  });

  const onSubmit = (data: NewsForm) => {
    setGlobalError('');
    createMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{existingSlug ? 'Editar Noticia' : 'Proponer Noticia'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {newsToEdit?.editorObservation && (
            <View style={styles.observationBanner}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={ClayTheme.colors.error} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.observationTitle}>Observaciones del editor:</Text>
                <Text style={styles.observationText}>{newsToEdit.editorObservation}</Text>
              </View>
            </View>
          )}

          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Título de la noticia"
                placeholder="Ej: Nueva plaza inaugurada"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.title?.message}
                ref={ref}
              />
            )}
          />

          <View style={styles.categoryContainer}>
            <Text style={styles.label}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setValue('category', cat.value as any)}
                  style={[
                    styles.categoryPill, 
                    selectedCategory === cat.value && styles.categoryPillActive
                  ]}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === cat.value && styles.categoryTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Controller
            control={control}
            name="excerpt"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Resumen (Opcional)"
                placeholder="Un breve resumen de qué trata"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.excerpt?.message}
                ref={ref}
              />
            )}
          />

          <Controller
            control={control}
            name="content"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Cuerpo de la noticia"
                placeholder="Escribe todos los detalles aquí..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.content?.message}
                multiline
                numberOfLines={8}
                style={{ height: 180, paddingTop: 16 }}
                ref={ref}
              />
            )}
          />

          <TouchableOpacity
            style={[styles.aiButton, (improveMutation.isPending || currentTitle.length < 3 || currentContent.length < 10) && styles.aiButtonDisabled]}
            onPress={improveWithAi}
            disabled={improveMutation.isPending || currentTitle.length < 3 || currentContent.length < 10}
            accessibilityRole="button"
            accessibilityLabel="Mejorar descripción y cuerpo con inteligencia artificial"
          >
            {improveMutation.isPending ? (
              <Text style={styles.aiButtonText}>La IA está preparando una sugerencia...</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="auto-fix" size={21} color={ClayTheme.categories.MUNICIPIO.text} />
                <Text style={styles.aiButtonText}>Mejorar descripción y cuerpo con IA</Text>
              </>
            )}
          </TouchableOpacity>

          <ClayButton 
            title={createMutation.isPending ? "Enviando..." : "Enviar a revisión"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={createMutation.isPending || isLoadingNews}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>

      <Modal visible={!!assistReview} transparent animationType="slide" onRequestClose={closeAssistReview}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Sugerencia de la IA</Text>
            <Text style={styles.modalDesc}>En verde lo que agrega y tachado lo que quita. Revisá que no cambie ningún dato antes de aplicarla.</Text>
            {assistReview && (
              <>
                <AiSuggestionField
                  label="Descripción"
                  original={assistReview.sent.excerpt ?? null}
                  value={assistExcerpt}
                  onChangeText={setAssistExcerpt}
                  maxLength={500}
                />
                <AiSuggestionField
                  label="Cuerpo de la noticia"
                  original={assistReview.sent.content}
                  value={assistContent}
                  onChangeText={setAssistContent}
                  tall
                />
              </>
            )}
            <View style={styles.modalActions}>
              <ClayButton title="Descartar" variant="secondary" onPress={closeAssistReview} style={{ flex: 1 }} />
              <ClayButton
                title="Aplicar sugerencia"
                onPress={applyAssistReview}
                disabled={!assistExcerpt.trim() || assistContent.trim().length < 10}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingBottom: 20, backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  content: { padding: 22 },
  form: { gap: 16 },
  submitButton: { marginTop: 20 },
  globalError: { color: ClayTheme.colors.error, fontSize: 14, fontFamily: ClayTheme.typography.fontFamily.semiBold, textAlign: 'center' },
  label: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.textInput, marginBottom: 8, paddingLeft: 4 },
  categoryContainer: { marginBottom: 10 },
  categoryScroll: { gap: 10, paddingBottom: 4 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: ClayTheme.colors.inputBg },
  categoryPillActive: { backgroundColor: ClayTheme.colors.primary },
  categoryText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.text },
  categoryTextActive: { color: ClayTheme.colors.primaryText },
  observationBanner: {
    backgroundColor: ClayTheme.colors.errorBg, padding: 16, borderRadius: ClayTheme.borders.radiusTile, flexDirection: 'row', alignItems: 'flex-start',
  },
  observationTitle: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 14, color: ClayTheme.colors.error, marginBottom: 4 },
  observationText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.error },
  aiButton: { minHeight: 56, borderRadius: ClayTheme.borders.radiusPill, paddingHorizontal: 22, backgroundColor: ClayTheme.categories.MUNICIPIO.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  aiButtonDisabled: { opacity: 0.45 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { maxHeight: '92%', backgroundColor: ClayTheme.colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalContent: { padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 21, color: ClayTheme.colors.text, marginBottom: 6 },
  modalDesc: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, lineHeight: 20, color: ClayTheme.colors.textMuted, marginBottom: 18 },
  modalActions: { flexDirection: 'row', gap: 10 },
  aiButtonText: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 14, color: ClayTheme.categories.MUNICIPIO.text, textAlign: 'center' },
});
