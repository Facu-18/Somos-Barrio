import { MaterialCommunityIcons } from '@expo/vector-icons';
import { listPerf } from '../../constants/ListPerf';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayCard } from '../../components/ClayCard';
import { ClayTheme } from '../../constants/ClayTheme';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

type NewsStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

interface OwnNews {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  status: NewsStatus;
  editorObservation: string | null;
  updatedAt: string;
}

const statusLabels: Record<NewsStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'En revisión',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Archivada',
};

export default function MyNewsScreen() {
  const { data: user } = useAuth();
  const barrioSlug = user?.barrio?.slug;
  const insets = useSafeAreaInsets();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['news-mine', barrioSlug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news/mine?limit=50`);
      return response.data.data.items as OwnNews[];
    },
    enabled: Boolean(barrioSlug),
  });

  const openNews = (news: OwnNews) => {
    if (news.status === 'DRAFT') {
      router.push({ pathname: '/(app)/create-news', params: { slug: news.slug } });
      return;
    }

    router.push({
      pathname: '/(app)/news/[slug]',
      params: { slug: news.slug, ...(news.status === 'PUBLISHED' ? {} : { preview: '1' }) },
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis propuestas</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/create-news')} style={styles.addButton} accessibilityLabel="Proponer noticia">
          <MaterialCommunityIcons name="plus" size={24} color={ClayTheme.colors.primaryText} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
        </View>
      ) : (
        <FlatList
        {...listPerf}
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<Text style={styles.empty}>Todavía no propusiste noticias.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openNews(item)} activeOpacity={0.85}>
              <ClayCard>
                <View style={styles.cardHeader}>
                  <Text style={styles.category}>{item.category}</Text>
                  <Text style={[styles.status, item.status === 'DRAFT' && styles.statusDraft]}>{statusLabels[item.status]}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                {item.excerpt ? <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt}</Text> : null}
                {item.editorObservation ? (
                  <View style={styles.observation}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={ClayTheme.colors.error} />
                    <Text style={styles.observationText}>{item.editorObservation}</Text>
                  </View>
                ) : null}
                <Text style={styles.action}>{item.status === 'DRAFT' ? 'Editar y reenviar' : 'Ver propuesta'}</Text>
              </ClayCard>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 16, backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevated },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayTheme.colors.inputBg },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayTheme.colors.primary },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 19, color: ClayTheme.colors.text },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  empty: { marginTop: 48, textAlign: 'center', fontFamily: ClayTheme.typography.fontFamily.medium, color: ClayTheme.colors.textMuted },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  category: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 11, color: ClayTheme.colors.primary },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E1EFE2', fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 11, color: ClayTheme.colors.primary },
  statusDraft: { backgroundColor: ClayTheme.states.warning.bg, color: ClayTheme.states.warning.text },
  title: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 18, color: ClayTheme.colors.text },
  excerpt: { marginTop: 7, fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: ClayTheme.colors.textInput },
  observation: { marginTop: 14, flexDirection: 'row', gap: 8, padding: 14, borderRadius: ClayTheme.borders.radiusMedia, backgroundColor: ClayTheme.colors.errorBg },
  observationText: { flex: 1, fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.error },
  action: { marginTop: 14, fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.primary },
});
