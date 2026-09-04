import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayButton } from '../../../components/ClayButton';
import { ClayTheme } from '../../../constants/ClayTheme';
import { useAuth } from '../../../hooks/useAuth';
import { api } from '../../../lib/api';

interface NewsDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  publishedAt: string;
  author: { nickname: string | null };
}

export default function NewsDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user?.barrio?.slug;
  const insets = useSafeAreaInsets();
  const { data: news, isLoading, isError, refetch } = useQuery({
    queryKey: ['news-detail', barrioSlug, slug],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/news/${slug}`);
      return response.data.data as NewsDetail;
    },
    enabled: Boolean(barrioSlug && slug),
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ClayTheme.colors.primary} /></View>;
  }
  if (isError || !news) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No se pudo cargar la noticia.</Text>
        <ClayButton title="Reintentar" onPress={() => refetch()} style={styles.retry} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Noticia</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}>
        <Text style={styles.category}>{news.category.charAt(0) + news.category.slice(1).toLowerCase()}</Text>
        <Text style={styles.title}>{news.title}</Text>
        <Text style={styles.meta}>
          {new Date(news.publishedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          {news.author.nickname ? ` · ${news.author.nickname}` : ''}
        </Text>
        {news.excerpt ? <Text style={styles.excerpt}>{news.excerpt}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.body}>{news.content}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: ClayTheme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 18, backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevated },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayTheme.colors.inputBg },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  headerSpacer: { width: 40 },
  content: { padding: 24, paddingTop: 34 },
  category: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#EAE7F2', color: '#57508A', fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 12 },
  title: { marginTop: 18, fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 30, lineHeight: 37, color: ClayTheme.colors.text },
  meta: { marginTop: 12, fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.textMuted },
  excerpt: { marginTop: 24, fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 18, lineHeight: 27, color: ClayTheme.colors.textInput },
  divider: { height: 2, marginVertical: 26, borderRadius: 2, backgroundColor: ClayTheme.colors.inputBg },
  body: { fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 17, lineHeight: 28, color: ClayTheme.colors.text },
  error: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 16, color: ClayTheme.colors.error, textAlign: 'center' },
  retry: { marginTop: 20 },
});
