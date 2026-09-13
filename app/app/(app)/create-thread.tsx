import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ClayInput } from '../../components/ClayInput';
import { api } from '../../lib/api';
import { ForumContentStatus, forumErrorMessage, forumModerationMessage } from '../../lib/forum';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const threadSchema = z.object({
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(255),
  content: z.string().trim().min(5, 'Escribe un poco más de detalle').max(5000),
});

type ThreadForm = z.infer<typeof threadSchema>;
type SavedThread = { id: string; title: string; content: string; status: ForumContentStatus; moderationReasonCode: string | null };

export default function CreateThreadScreen() {
  // Con threadId la pantalla corrige un hilo propio en lugar de crear uno nuevo.
  const { subforumSlug, threadId } = useLocalSearchParams<{ subforumSlug: string; threadId?: string }>();
  const isEditing = !!threadId;
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');

  const { data: existingThread, isLoading: isLoadingThread } = useQuery({
    queryKey: ['thread-detail', barrioSlug, subforumSlug, threadId],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}`);
      return response.data.data as SavedThread;
    },
    enabled: isEditing,
  });

  const { control, handleSubmit, formState: { errors } } = useForm<ThreadForm>({
    resolver: zodResolver(threadSchema),
    defaultValues: { title: '', content: '' },
    values: existingThread ? { title: existingThread.title, content: existingThread.content } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ThreadForm) => {
      const response = isEditing
        ? await api.patch(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}`, data)
        : await api.post(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads`, data);
      return response.data.data as SavedThread;
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ['threads', barrioSlug, subforumSlug] });
      queryClient.invalidateQueries({ queryKey: ['subforums', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['thread-detail', barrioSlug, subforumSlug, thread.id] });

      if (thread.status === 'PUBLISHED') {
        router.back();
        return;
      }
      Alert.alert(
        thread.status === 'BLOCKED' ? 'No se publicó tu hilo' : 'Tu hilo quedó en revisión',
        forumModerationMessage(thread.status, thread.moderationReasonCode)
      );
      if (isEditing) {
        router.back();
      } else {
        router.replace({ pathname: '/(app)/thread/[id]', params: { id: thread.id, subforumSlug } });
      }
    },
    onError: (error: any) => {
      setGlobalError(forumErrorMessage(error, isEditing ? 'Error al guardar los cambios.' : 'Error al crear la publicación.'));
    }
  });

  const onSubmit = (data: ThreadForm) => {
    setGlobalError('');
    createMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Conversación' : 'Nueva Conversación'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {isEditing && isLoadingThread ? (
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          {isEditing ? 'Editando en ' : 'Estás publicando en '}<Text style={{ color: ClayTheme.colors.primaryText }}>{subforumSlug}</Text>
        </Text>

        <View style={styles.form}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Título"
                placeholder="Ej: ¿Alguien sabe a qué hora pasa el basurero?"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.title?.message}
              
                ref={ref}
              />
            )}
          />

          <Controller
            control={control}
            name="content"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Detalle"
                placeholder="Escribí acá toda la información..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.content?.message}
                multiline
                numberOfLines={6}
                style={{ height: 120, paddingTop: 16 }}
              
                ref={ref}
              />
            )}
          />

          <ClayButton
            title={createMutation.isPending ? (isEditing ? "Guardando..." : "Publicando...") : (isEditing ? "Guardar cambios" : "Publicar")}
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClayTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: ClayTheme.colors.text,
  },
  content: {
    padding: 22,
  },
  subtitle: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 10,
  },
  submitButton: {
    marginTop: 20,
  },
  globalError: {
    color: ClayTheme.colors.error,
    fontSize: 14,
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    textAlign: 'center',
    marginBottom: 16,
  }
});
