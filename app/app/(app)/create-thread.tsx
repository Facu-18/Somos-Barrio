import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ClayInput } from '../../components/ClayInput';
import { api } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const threadSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').max(255),
  content: z.string().min(5, 'Escribe un poco más de detalle').max(5000),
});

type ThreadForm = z.infer<typeof threadSchema>;

export default function CreateThreadScreen() {
  const { subforumSlug } = useLocalSearchParams<{ subforumSlug: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user?.barrio?.slug || 'palermo';
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm<ThreadForm>({
    resolver: zodResolver(threadSchema),
    defaultValues: { title: '', content: '' }
  });

  const createMutation = useMutation({
    mutationFn: async (data: ThreadForm) => {
      const response = await api.post(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads`, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate threads query so the new thread appears
      queryClient.invalidateQueries({ queryKey: ['threads', barrioSlug, subforumSlug] });
      router.back();
    },
    onError: (error: any) => {
      setGlobalError(error.response?.data?.message || 'Error al crear la publicación.');
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
        <Text style={styles.headerTitle}>Nueva Conversación</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Estás publicando en <Text style={{ color: ClayTheme.colors.primaryText }}>{subforumSlug}</Text>
        </Text>

        <View style={styles.form}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <ClayInput
                label="Título"
                placeholder="Ej: ¿Alguien sabe a qué hora pasa el basurero?"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.title?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="content"
            render={({ field: { onChange, onBlur, value } }) => (
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
              />
            )}
          />

          <ClayButton 
            title={createMutation.isPending ? "Publicando..." : "Publicar"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={createMutation.isPending}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
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
