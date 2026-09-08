import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayButton } from '../../../components/ClayButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string;
  _count: {
    rsvps: number;
  };
  myRsvp: 'GOING' | 'INTERESTED' | 'NOT_GOING' | null;
  user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data: event, isLoading, isError, refetch } = useQuery({
    queryKey: ['event-detail', barrioSlug, id],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/events/${id}`);
      return response.data.data as EventDetail;
    },
    enabled: !!id && !!user,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (status: 'GOING' | 'INTERESTED' | 'NOT_GOING') => {
      await api.post(`/barrios/${barrioSlug}/events/${id}/rsvp`, { status });
      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', barrioSlug, id] });
      queryClient.invalidateQueries({ queryKey: ['events', barrioSlug] });
    },
    onError: () => Alert.alert('No se pudo guardar', 'Tu respuesta no cambió. Intentá nuevamente.'),
  });

  const getInitials = (name?: string | null) => (name?.trim()?.slice(0, 2) || '?').toUpperCase();
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' a las');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar el evento.</Text>
        <ClayButton title="Reintentar" onPress={() => refetch()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const isGoing = event.myRsvp === 'GOING';
  const isInterested = event.myRsvp === 'INTERESTED';
  const isNotGoing = event.myRsvp === 'NOT_GOING';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>{event.title}</Text>
          
          <View style={styles.organizerRow}>
            {event.user.avatarUrl ? (
              <Image source={{ uri: event.user.avatarUrl }} style={styles.organizerAvatar} />
            ) : (
              <View style={[styles.organizerAvatar, { backgroundColor: '#EAE7F2', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 12, color: '#57508A' }}>
                  {getInitials(event.user.nickname)}
                </Text>
              </View>
            )}
            <Text style={styles.organizerName}>por {event.user.nickname || 'un vecino'}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: '#E1EFE2' }]}>
              <MaterialCommunityIcons name="calendar" size={20} color="#35663A" />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Fecha y hora</Text>
              <Text style={[{textTransform: 'capitalize'}, styles.detailValue]}>
                {formatDate(event.date)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: '#F7E0D2' }]}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#9A5227" />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Ubicación</Text>
              <Text style={styles.detailValue}>{event.location}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: '#E2ECF6' }]}>
              <MaterialCommunityIcons name="account-group" size={20} color="#3E6288" />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Asistentes confirmados</Text>
              <Text style={styles.detailValue}>{event._count.rsvps} personas</Text>
            </View>
          </View>
        </View>

        {event.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Acerca del evento</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

      </ScrollView>
      
      {/* RSVP Action Bar Fixed at Bottom */}
      <View style={[styles.rsvpContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.rsvpPrompt}>{rsvpMutation.isPending ? 'Guardando respuesta...' : '¿Vas a ir?'}</Text>
        <View style={styles.rsvpButtons}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => rsvpMutation.mutate('GOING')}
            disabled={rsvpMutation.isPending}
            accessibilityRole="button"
            accessibilityState={{ selected: isGoing, disabled: rsvpMutation.isPending }}
            style={[styles.rsvpBtn, isGoing && styles.rsvpBtnActiveGoing]}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={isGoing ? ClayTheme.colors.primaryText : ClayTheme.colors.textMuted} />
            <Text style={[styles.rsvpBtnText, isGoing && styles.rsvpBtnTextGoing]}>Asistiré</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => rsvpMutation.mutate('INTERESTED')}
            disabled={rsvpMutation.isPending}
            accessibilityRole="button"
            accessibilityState={{ selected: isInterested, disabled: rsvpMutation.isPending }}
            style={[styles.rsvpBtn, isInterested && styles.rsvpBtnActiveInterested]}
          >
            <MaterialCommunityIcons name="star-outline" size={20} color={isInterested ? '#6B3D12' : ClayTheme.colors.textMuted} />
            <Text style={[styles.rsvpBtnText, isInterested && styles.rsvpBtnTextInterested]}>Me interesa</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => rsvpMutation.mutate('NOT_GOING')}
            disabled={rsvpMutation.isPending}
            accessibilityRole="button"
            accessibilityState={{ selected: isNotGoing, disabled: rsvpMutation.isPending }}
            style={[styles.rsvpBtn, isNotGoing && styles.rsvpBtnActiveNotGoing]}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={20} color={isNotGoing ? ClayTheme.colors.error : ClayTheme.colors.textMuted} />
            <Text style={[styles.rsvpBtnText, isNotGoing && styles.rsvpBtnTextNotGoing]}>No iré</Text>
          </TouchableOpacity>
        </View>
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
    color: ClayTheme.colors.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: ClayTheme.colors.background,
    zIndex: 10,
  },
  closeButton: {
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
    marginLeft: 16,
  },
  content: {
    padding: 24,
    paddingBottom: 160,
  },
  titleSection: {
    marginBottom: 30,
  },
  title: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 32,
    color: ClayTheme.colors.text,
    lineHeight: 38,
    marginBottom: 16,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  organizerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  organizerName: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
  },
  detailsCard: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 24,
    padding: 20,
    ...ClayTheme.shadows.elevated,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 15,
    color: ClayTheme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: ClayTheme.colors.inputBg,
    marginVertical: 16,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 20,
    color: ClayTheme.colors.text,
    marginBottom: 12,
  },
  description: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: ClayTheme.colors.textInput,
  },
  rsvpContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: ClayTheme.colors.surface,
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    ...ClayTheme.shadows.elevated,
  },
  rsvpPrompt: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: ClayTheme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rsvpBtn: {
    flex: 1,
    backgroundColor: ClayTheme.colors.inputBg,
    minHeight: 62,
    justifyContent: 'center',
    borderRadius: ClayTheme.borders.radiusTile,
    alignItems: 'center',
    gap: 6,
  },
  rsvpBtnActiveGoing: {
    backgroundColor: ClayTheme.colors.primary,
    ...ClayTheme.shadows.primary,
  },
  rsvpBtnActiveInterested: {
    backgroundColor: ClayTheme.colors.secondary,
    ...ClayTheme.shadows.secondary,
  },
  rsvpBtnActiveNotGoing: {
    backgroundColor: ClayTheme.colors.errorBg,
  },
  rsvpBtnText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  rsvpBtnTextGoing: { color: ClayTheme.colors.primaryText, fontFamily: ClayTheme.typography.fontFamily.extraBold },
  rsvpBtnTextInterested: { color: '#6B3D12', fontFamily: ClayTheme.typography.fontFamily.extraBold },
  rsvpBtnTextNotGoing: { color: ClayTheme.colors.error, fontFamily: ClayTheme.typography.fontFamily.extraBold }
});
