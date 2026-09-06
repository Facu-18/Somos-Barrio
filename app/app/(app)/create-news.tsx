import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
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

const newsSchema = z.object({
  title: z.string().min(3, 'El título es muy corto').max(255),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
  category: z.enum(['SEGURIDAD', 'OBRAS', 'EVENTOS', 'MUNICIPIO', 'COMUNIDAD']),
});

type NewsForm = z.infer<typeof newsSchema>;

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
    queryKey: ['news-detail', barrioSlug, existingSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news/${existingSlug}`);
      return response.data.data;
    },
    enabled: !!existingSlug,
  });

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<NewsForm>({
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
      queryClient.invalidateQueries({ queryKey: ['news', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['my-posts', barrioSlug] });
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

          <ClayButton 
            title={createMutation.isPending ? "Enviando..." : "Enviar a revisión"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={createMutation.isPending || isLoadingNews}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
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
    backgroundColor: '#FFE5E5', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'flex-start',
  },
  observationTitle: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 14, color: ClayTheme.colors.error, marginBottom: 4 },
  observationText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.error },
});
