import React, { useState, useEffect } from 'react';
import { listPerf } from '../../../constants/ListPerf';
import { View, Text, StyleSheet, ScrollView, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme } from '../../../constants/ClayTheme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState } from '../../../components/EmptyState';

interface Subforum {
  id: string;
  name: string;
  slug: string;
}

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  upVotes: number;
  _count: {
    replies: number;
  };
  user: {
    name: string;
    nickname?: string;
    avatarUrl?: string;
  };
}

export default function ForumScreen() {
  const { data: user, isLoading: isLoadingUser } = useAuth();
  const barrioSlug = user!.barrio!.slug;

  const [selectedSubforum, setSelectedSubforum] = useState<string | null>(null);

  // Fetch subforums
  const { data: subforums, isLoading: isLoadingSubforums } = useQuery({
    queryKey: ['subforums', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/forum`);
      return response.data.data as Subforum[];
    },
    enabled: !!user,
  });

  // Auto-select first subforum when loaded
  useEffect(() => {
    if (subforums && subforums.length > 0 && !selectedSubforum) {
      setSelectedSubforum(subforums[0].slug);
    }
  }, [subforums, selectedSubforum]);

  // Fetch threads for selected subforum
  const { data: threads, isLoading: isLoadingThreads, refetch, isRefetching } = useQuery({
    queryKey: ['threads', barrioSlug, selectedSubforum],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/forum/${selectedSubforum}/threads?limit=20`);
      return response.data.data.items as Thread[];
    },
    enabled: !!selectedSubforum,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name?: string | null) => (name?.trim()?.slice(0, 2) || '?').toUpperCase();

  const getAvatarStyle = (index: number) => {
    const styles = [
      { bg: '#F7E0D2', text: '#9A5227' },
      { bg: '#E2ECF6', text: '#3E6288' },
      { bg: '#EAE7F2', text: '#57508A' },
      { bg: '#E1EFE2', text: '#35663A' },
    ];
    return styles[index % styles.length];
  };

  if (isLoadingUser || isLoadingSubforums) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Subforums Horizontal List */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Foro</Text>
        <Text style={styles.subtitle}>{user?.barrio?.name || 'Tu barrio'}</Text>
      </View>

      <View style={styles.subforumsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subforumsScroll}>
          {subforums?.map((sf) => {
            const isActive = sf.slug === selectedSubforum;
            return (
              <TouchableOpacity
                key={sf.id}
                activeOpacity={0.7}
                onPress={() => setSelectedSubforum(sf.slug)}
                style={[styles.subforumTab, isActive ? styles.subforumTabActive : styles.subforumTabInactive]}
              >
                <Text style={[styles.subforumText, isActive ? styles.subforumTextActive : styles.subforumTextInactive]}>
                  {sf.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        {...listPerf}
        data={threads ?? []}
        keyExtractor={(thread) => thread.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item: thread, index }) => {
              const avatarStyle = getAvatarStyle(index);
          return (
                <TouchableOpacity 
                  style={styles.threadCard}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/(app)/thread/[id]', params: { id: thread.id, subforumSlug: selectedSubforum } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${thread.title}, ${thread._count?.replies || 0} respuestas`}
                >
                  <View style={[styles.avatar, { backgroundColor: avatarStyle.bg }]}>
                    {thread.user?.avatarUrl ? (
                      <Image source={{ uri: thread.user.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarText, { color: avatarStyle.text }]}>
                        {getInitials(thread.user?.name || 'XX')}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.threadContent}>
                    <Text style={styles.threadTitle} numberOfLines={2}>{thread.title}</Text>
                    
                    <View style={styles.threadMetaRow}>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="arrow-up" size={14} color={ClayTheme.colors.textMuted} />
                        <Text style={styles.metaText}>{thread.upVotes || 0}</Text>
                      </View>
                      
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="comment-outline" size={14} color={ClayTheme.colors.textMuted} />
                        <Text style={styles.metaText}>{thread._count?.replies || 0}</Text>
                      </View>
                      
                      <Text style={styles.timeAgo}>{formatDate(thread.createdAt)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
          );
        }}
        ListEmptyComponent={isLoadingThreads
          ? <ActivityIndicator size="large" color={ClayTheme.colors.primary} style={{ marginTop: 40 }} />
          : <EmptyState 
              iconName="message-text-outline" 
              title="Este subforo está vacío" 
              description="Animate a iniciar la primera conversación." 
              actionLabel="Abrir un tema" 
              onAction={() => router.push({ pathname: '/(app)/create-thread', params: { subforumSlug: selectedSubforum || '' }})}
            />}
      />

      {/* FAB Button */}
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/(app)/create-thread', params: { subforumSlug: selectedSubforum || '' }})}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Crear hilo"
      >
        <MaterialCommunityIcons name="plus" size={30} color={ClayTheme.colors.primaryText} />
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 22,
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
  subforumsContainer: {
    marginBottom: 10,
  },
  subforumsScroll: {
    paddingHorizontal: 22,
    gap: 10,
    alignItems: 'center',
  },
  subforumTab: {
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subforumTabActive: {
    backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
  },
  subforumTabInactive: {
    backgroundColor: '#EBE8E1',
  },
  subforumText: {
    fontSize: 14,
  },
  subforumTextActive: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    color: ClayTheme.colors.text,
  },
  subforumTextInactive: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    color: ClayTheme.colors.textInput,
  },
  content: {
    paddingBottom: 120, // space for tab bar
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  threadsList: {
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: 13,
  },
  threadCard: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 26,
    padding: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 13,
    ...ClayTheme.shadows.elevated,
    marginBottom: 13,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  avatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 13,
  },
  threadContent: {
    flex: 1,
    gap: 7,
  },
  threadTitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 16,
    color: ClayTheme.colors.text,
    lineHeight: 21,
  },
  threadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  timeAgo: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 12,
    color: ClayTheme.colors.textInput,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 110, // space for tab bar
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: ClayTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  emptyText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  }
});
