import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import type { MarketplaceReasonCode } from '../../types/api';

type PostQueue = 'PENDING_REVIEW' | 'REPORTED' | 'REJECTED' | 'REMOVED' | 'APPEALED' | 'DELETED';
type Decision = 'APPROVE' | 'REJECT' | 'REMOVE' | 'RESTORE';
type AssetDecision = 'APPROVE' | 'REJECT';

const postQueues: { value: PostQueue; label: string }[] = [
  { value: 'PENDING_REVIEW', label: 'Pendientes' },
  { value: 'REPORTED', label: 'Reportadas' },
  { value: 'APPEALED', label: 'Apeladas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'REMOVED', label: 'Retiradas' },
  { value: 'DELETED', label: 'Eliminadas' },
];

const reasonByDecision: Record<Decision | AssetDecision, MarketplaceReasonCode> = {
  APPROVE: 'POLICY_COMPLIANT',
  REJECT: 'OTHER_POLICY',
  REMOVE: 'REPORT_REVIEW',
  RESTORE: 'POLICY_COMPLIANT',
};

export default function AdminMarketQueueScreen() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<PostQueue>('PENDING_REVIEW');
  const [showAssets, setShowAssets] = useState(false);
  const [page, setPage] = useState(1);
  const [barrioFilter, setBarrioFilter] = useState(user?.barrio?.slug || '');
  const [target, setTarget] = useState<any>(null);
  const [decision, setDecision] = useState<Decision | AssetDecision>('APPROVE');
  const [reasonCode, setReasonCode] = useState<MarketplaceReasonCode>('POLICY_COMPLIANT');
  const [privateNote, setPrivateNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const params = { page, limit: 20, ...(barrioFilter.trim() ? { barrioSlug: barrioFilter.trim() } : {}) };
  const postsQuery = useQuery({
    queryKey: ['moderation-marketplace', queue, params],
    queryFn: async () => (await api.get('/moderation/marketplace', { params: { ...params, queue } })).data.data,
    enabled: !!user && !showAssets && ['ADMIN', 'EDITOR'].includes(user.role),
  });
  const assetsQuery = useQuery({
    queryKey: ['moderation-marketplace-assets', params],
    queryFn: async () => (await api.get('/moderation/marketplace/assets', { params })).data.data,
    enabled: !!user && showAssets && ['ADMIN', 'EDITOR'].includes(user.role),
  });
  const activeQuery = showAssets ? assetsQuery : postsQuery;

  const decisionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        decision,
        reasonCode,
        privateNote: privateNote.trim() || undefined,
        expectedVersion: target.moderationVersion,
        idempotencyKey,
      };
      const endpoint = showAssets
        ? `/moderation/marketplace/assets/${target.id}/decision`
        : `/moderation/marketplace/${target.id}/decision`;
      return (await api.post(endpoint, payload)).data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['moderation-marketplace'] }),
        queryClient.invalidateQueries({ queryKey: ['moderation-marketplace-assets'] }),
      ]);
      setTarget(null);
      setPrivateNote('');
      Alert.alert('Decisión registrada', 'La cola se actualizó con la última versión.');
    },
    onError: async (error: any) => {
      if (error.response?.status === 409) await activeQuery.refetch();
      Alert.alert('No se pudo registrar', error.response?.data?.message || 'Actualizá la cola e intentá nuevamente.');
    },
  });

  const openDecision = (item: any, nextDecision: Decision | AssetDecision) => {
    setTarget(item);
    setDecision(nextDecision);
    setReasonCode(reasonByDecision[nextDecision]);
    setPrivateNote('');
    setIdempotencyKey(Crypto.randomUUID());
  };

  const submitDecision = () => {
    decisionMutation.mutate();
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.version}>v{item.moderationVersion}</Text>
      </View>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={styles.meta}>Por {item.user?.nickname || item.user?.name} · {item.moderationStatus}</Text>
      {item.reports?.length ? <Text style={styles.warning}>{item.reports.length} reporte(s) sin resolver</Text> : null}
      {item.appeals?.[0] ? <Text style={styles.appeal}>Apelación: {item.appeals[0].statement}</Text> : null}
      {item.decisions?.length ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Últimas decisiones</Text>
          {item.decisions.map((entry: any) => (
            <Text key={entry.id} style={styles.historyText}>{entry.action} · {entry.reasonCode} · v{entry.toVersion}</Text>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {(['PENDING_REVIEW', 'REJECTED'].includes(item.moderationStatus) || item.appeals?.[0]) && <Action label="Aprobar" color="#15803d" onPress={() => openDecision(item, 'APPROVE')} />}
        {(item.moderationStatus === 'PENDING_REVIEW' || item.appeals?.[0]) && <Action label={item.appeals?.[0] ? 'Rechazar apelación' : 'Rechazar'} color="#dc2626" onPress={() => openDecision(item, 'REJECT')} />}
        {item.moderationStatus === 'APPROVED' && <Action label="Retirar" color="#dc2626" onPress={() => openDecision(item, 'REMOVE')} />}
        {item.moderationStatus === 'REMOVED' && !item.appeals?.[0] && <Action label="Restaurar" color="#2563eb" onPress={() => openDecision(item, 'RESTORE')} />}
      </View>
    </View>
  );

  const renderAsset = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {item.previewUrl ? <Image source={{ uri: item.previewUrl }} style={styles.preview} /> : null}
      <Text style={styles.meta}>{item.mimeType} · {Math.ceil(item.byteSize / 1024)} KB · v{item.moderationVersion}</Text>
      <View style={styles.actions}>
        <Action label="Aprobar imagen" color="#15803d" onPress={() => openDecision(item, 'APPROVE')} />
        <Action label="Rechazar imagen" color="#dc2626" onPress={() => openDecision(item, 'REJECT')} />
      </View>
    </View>
  );

  const data = activeQuery.data;
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}><MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Moderación Market</Text>
        <TouchableOpacity onPress={() => activeQuery.refetch()} style={styles.iconButton}><MaterialCommunityIcons name="refresh" size={24} color={ClayTheme.colors.text} /></TouchableOpacity>
      </View>
      <View style={styles.filters}>
        <TextInput value={barrioFilter} onChangeText={setBarrioFilter} onSubmitEditing={() => setPage(1)} placeholder="Slug de barrio (opcional)" style={styles.filterInput} autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {postQueues.map((option) => <Tab key={option.value} label={option.label} active={!showAssets && queue === option.value} onPress={() => { setShowAssets(false); setQueue(option.value); setPage(1); }} />)}
          <Tab label="Imágenes" active={showAssets} onPress={() => { setShowAssets(true); setPage(1); }} />
        </ScrollView>
      </View>
      {activeQuery.isLoading ? <ActivityIndicator size="large" color={ClayTheme.colors.primary} style={styles.loader} /> : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={showAssets ? renderAsset : renderPost}
          contentContainerStyle={styles.list}
          refreshing={activeQuery.isRefetching}
          onRefresh={activeQuery.refetch}
          ListEmptyComponent={<Text style={styles.empty}>No hay elementos en esta cola.</Text>}
          ListFooterComponent={data?.total > data?.limit ? (
            <View style={styles.pagination}>
              <ClayButton title="Anterior" variant="secondary" disabled={page === 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
              <Text style={styles.meta}>Página {page}</Text>
              <ClayButton title="Siguiente" variant="secondary" disabled={page * data.limit >= data.total} onPress={() => setPage((value) => value + 1)} />
            </View>
          ) : null}
        />
      )}
      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <Text style={styles.modalTitle}>{decision} {showAssets ? 'imagen' : 'publicación'}</Text>
          <Text style={styles.label}>Código de motivo</Text>
          <TextInput value={reasonCode} onChangeText={(value) => setReasonCode(value as MarketplaceReasonCode)} autoCapitalize="characters" style={styles.input} />
          <Text style={styles.label}>Nota privada</Text>
          <TextInput value={privateNote} onChangeText={setPrivateNote} multiline maxLength={2000} style={[styles.input, styles.multiline]} />
          <View style={styles.actions}>
            <ClayButton title="Cancelar" variant="secondary" onPress={() => setTarget(null)} style={{ flex: 1 }} />
            <ClayButton title="Confirmar" loading={decisionMutation.isPending} onPress={submitDecision} style={{ flex: 1 }} />
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.action, { backgroundColor: color }]} onPress={onPress}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>;
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.tab, active && styles.activeTab]} onPress={onPress}><Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevated },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: ClayTheme.colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingTop: 14 },
  filterInput: { marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: ClayTheme.colors.surface, color: ClayTheme.colors.text },
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: ClayTheme.colors.inputBg },
  activeTab: { backgroundColor: ClayTheme.colors.primary },
  tabText: { color: ClayTheme.colors.textMuted, fontFamily: ClayTheme.typography.fontFamily.bold },
  activeTabText: { color: ClayTheme.colors.primaryText },
  loader: { marginTop: 50 },
  list: { padding: 20, gap: 16, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: ClayTheme.colors.textMuted },
  card: { backgroundColor: ClayTheme.colors.surface, borderRadius: 20, padding: 18, gap: 10, ...ClayTheme.shadows.elevated },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 17, color: ClayTheme.colors.text },
  version: { color: ClayTheme.colors.textMuted },
  description: { color: ClayTheme.colors.textMuted },
  meta: { fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 12, color: ClayTheme.colors.textMuted },
  warning: { color: '#b45309', fontFamily: ClayTheme.typography.fontFamily.bold },
  appeal: { color: '#7c3aed', fontFamily: ClayTheme.typography.fontFamily.semiBold },
  history: { borderTopWidth: 1, borderTopColor: ClayTheme.colors.inputBg, paddingTop: 8 },
  historyTitle: { fontFamily: ClayTheme.typography.fontFamily.bold, color: ClayTheme.colors.text },
  historyText: { fontSize: 11, color: ClayTheme.colors.textMuted, marginTop: 3 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: ClayTheme.colors.inputBg },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  action: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  actionText: { color: 'white', fontFamily: ClayTheme.typography.fontFamily.bold },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { padding: 24, paddingBottom: 40, backgroundColor: ClayTheme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 21, color: ClayTheme.colors.text, marginBottom: 18 },
  label: { fontFamily: ClayTheme.typography.fontFamily.bold, color: ClayTheme.colors.text, marginBottom: 6 },
  input: { backgroundColor: ClayTheme.colors.surface, borderRadius: 14, padding: 13, color: ClayTheme.colors.text, marginBottom: 14 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
});
