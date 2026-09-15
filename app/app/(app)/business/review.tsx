import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayInput } from '../../../components/ClayInput';
import { ClayButton } from '../../../components/ClayButton';
import { StarRating } from '../../../components/StarRating';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFormBottomPadding } from '../../../hooks/useTabBarSpace';

export default function CreateReviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const formBottomPadding = useFormBottomPadding();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (rating === 0) throw new Error('Por favor, selecciona una calificación.');
      
      const payload = {
        rating,
        comment: comment.trim() || undefined,
      };

      await api.post(`/barrios/${barrioSlug}/businesses/${slug}/reviews`, payload);
    },
    onSuccess: () => {
      // Invalidate both lists and detail to reflect new rating and review
      queryClient.invalidateQueries({ queryKey: ['business-detail', barrioSlug, slug] });
      queryClient.invalidateQueries({ queryKey: ['businesses', barrioSlug] });
      router.back();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error.message || 'Error al enviar la reseña.';
      Alert.alert('No se pudo enviar', msg);
    }
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calificar comercio</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: formBottomPadding }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>¿Qué te pareció?</Text>
          <Text style={styles.subtitle}>Tu opinión ayuda a otros vecinos a conocer más sobre este comercio.</Text>
          
          <View style={styles.starsContainer}>
            <StarRating 
              rating={rating} 
              onRatingChange={setRating} 
              size={44} 
              spacing={12} 
            />
          </View>

          <ClayInput
            label="Comentario (Opcional)"
            placeholder="Contanos tu experiencia..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            containerStyle={styles.inputContainer}
          />

          <ClayButton
            title={mutation.isPending ? 'Enviando...' : 'Enviar reseña'}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending || rating === 0}
            style={styles.submitButton}
          />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ClayTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  headerTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 20,
    color: ClayTheme.colors.text,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 28,
    padding: 24,
    ...ClayTheme.shadows.elevated,
    alignItems: 'center',
  },
  title: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 22,
    color: ClayTheme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  starsContainer: {
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  submitButton: {
    width: '100%',
  }
});
