import React, { useState } from 'react';
import { listPerf } from '../../../constants/ListPerf';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme } from '../../../constants/ClayTheme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState } from '../../../components/EmptyState';

interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  _count: {
    rsvps: number;
  };
  myRsvp: 'GOING' | 'INTERESTED' | 'NOT_GOING' | null;
  user: {
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export default function EventsScreen() {
  const { data: user, isLoading: isLoadingUser } = useAuth();
  const { fabBottom, listPaddingBottom } = useTabBarSpace(64);
  const barrioSlug = user!.barrio!.slug;
  const [upcoming, setUpcoming] = useState(true);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['events', barrioSlug, upcoming],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/events?upcoming=${upcoming}&limit=20`);
      return response.data.data.items as EventItem[];
    },
    enabled: !!user,
  });

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

  const getInitials = (name?: string | null) => (name?.trim()?.slice(0, 2) || '?').toUpperCase();

  const getPlaceholderStyle = (index: number) => {
    const styles = [
      { bg: '#E2ECF6', text: '#3E6288', badgeBg: '#C2D9ED' },
      { bg: '#F7E0D2', text: '#9A5227', badgeBg: '#EFCDBA' },
      { bg: '#F6EBD2', text: '#856520', badgeBg: '#E8D4AC' },
      { bg: '#E1EFE2', text: '#35663A', badgeBg: '#CDE5CF' },
    ];
    return styles[index % styles.length];
  };

  if (isLoadingUser || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        {...listPerf}
        data={data ?? []}
        keyExtractor={(event) => event.id}
        contentContainerStyle={[styles.content, { paddingBottom: listPaddingBottom }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <Text style={styles.sectionTitle}>Eventos</Text>
              <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
            </View>
            <View style={styles.filterContainer}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.segmentBtn, upcoming && styles.segmentBtnActive]} onPress={() => setUpcoming(true)} accessibilityRole="button" accessibilityState={{ selected: upcoming }}>
                  <Text style={[styles.segmentText, upcoming && styles.segmentTextActive]}>Próximos</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.segmentBtn, !upcoming && styles.segmentBtnActive]} onPress={() => setUpcoming(false)} accessibilityRole="button" accessibilityState={{ selected: !upcoming }}>
                  <Text style={[styles.segmentText, !upcoming && styles.segmentTextActive]}>Pasados</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        renderItem={({ item: event, index }) => {
          const pStyle = getPlaceholderStyle(index);
            const eventDate = new Date(event.date);
            const day = eventDate.getDate();
            const month = eventDate.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase();
          return (
              <TouchableOpacity
                activeOpacity={0.8} 
                style={styles.card}
                onPress={() => router.push({ pathname: '/(app)/event/[id]', params: { id: event.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}, ${formatDate(event.date)}`}
              >
                <View style={[styles.dateBadge, { backgroundColor: pStyle.bg }]}>
                  <Text style={[styles.dateBadgeMonth, { color: pStyle.text }]}>{month}</Text>
                  <Text style={[styles.dateBadgeDay, { color: pStyle.text }]}>{day}</Text>
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.eventTime}>{formatDate(event.date)}</Text>
                  
                  <View style={styles.locationRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={ClayTheme.colors.textMuted} />
                    <Text style={styles.locationText} numberOfLines={1}>{event.location}</Text>
                  </View>

                  <View style={styles.footerRow}>
                    <View style={styles.organizerRow}>
                      {event.user.avatarUrl ? (
                        <Image source={{ uri: event.user.avatarUrl }} style={styles.organizerAvatar} />
                      ) : (
                        <View style={[styles.organizerAvatar, { backgroundColor: '#EAE7F2', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 8, color: '#57508A' }}>
                            {getInitials(event.user.nickname)}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.organizerName}>por {event.user.nickname || 'un vecino'}</Text>
                    </View>

                    <View style={[styles.rsvpsBadge, { backgroundColor: pStyle.badgeBg }]}>
                      <MaterialCommunityIcons name="account-group" size={14} color={pStyle.text} />
                      <Text style={[styles.rsvpsText, { color: pStyle.text }]}>{event._count.rsvps} van</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState 
            iconName="calendar-blank-outline" 
            title={`No hay eventos ${upcoming ? 'próximos' : 'pasados'}`} 
            description="Sé la primera persona en organizar algo." 
            actionLabel="Organizá el primero" 
            onAction={() => router.push('/(app)/event/create')} 
          />
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        activeOpacity={0.8}
        onPress={() => router.push('/(app)/event/create')}
        accessibilityRole="button"
        accessibilityLabel="Crear nuevo evento"
      >
        <MaterialCommunityIcons name="calendar-plus" size={28} color={ClayTheme.colors.surface} />
      </TouchableOpacity>
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
  content: {
    paddingTop: 60,
    paddingHorizontal: 22,
  },
  header: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 28,
    color: ClayTheme.colors.text,
  },
  subtitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.textMuted,
    marginTop: 2,
  },
  filterContainer: {
    marginBottom: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: ClayTheme.colors.inputBg,
    borderRadius: 999,
    padding: 4,
    ...ClayTheme.shadows.sunk,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
  },
  segmentText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
  },
  segmentTextActive: {
    color: ClayTheme.colors.text,
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    ...ClayTheme.shadows.elevated,
    marginBottom: 16,
  },
  dateBadge: {
    width: 60,
    height: 70,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBadgeMonth: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 11,
  },
  dateBadgeDay: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 24,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: ClayTheme.colors.text,
    marginBottom: 4,
  },
  eventTime: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 13,
    color: ClayTheme.colors.primary,
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  organizerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  organizerName: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 11,
    color: ClayTheme.colors.textMuted,
  },
  rsvpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rsvpsText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 11,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ClayTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...ClayTheme.shadows.primary,
    elevation: 8,
  }
});
