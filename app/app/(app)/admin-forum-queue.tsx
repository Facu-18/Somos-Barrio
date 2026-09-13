import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { uuidV4 } from '../../lib/uuid';
import { useAuth } from '../../hooks/useAuth';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ForumContentStatus, forumErrorMessage, forumReportCategories, forumStatusInfo } from '../../lib/forum';

type Target = 'THREAD' | 'REPLY';
type Queue = 'PENDING_REVIEW' | 'REPORTED' | 'APPEALED' | 'BLOCKED' | 'REMOVED';
type Decision = 'APPROVE' | 'BLOCK' | 'REMOVE' | 'RESTORE';
type ReasonCode = 'POLICY_COMPLIANT' | 'THREAT' | 'HARASSMENT' | 'DISCRIMINATION' | 'INAPPROPRIATE_CONTENT' | 'SPAM' | 'REPORT_REVIEW' | 'OTHER_POLICY';

interface ModerationItem {
  id: string;
  title?: string;
  content: string;
  status: ForumContentStatus;
  moderationVersion: number;
  moderationReasonCode: string | null;
  user: { id: string; name: string; nickname?: string | null };
  thread?: { id: string; title: string };
  reports: { id: string; category: string; comment: string | null; createdAt: string }[];
  appeals: { id: string; statement: string; createdAt: string }[];
  decisions: { id: string; action: string; reasonCode: string | null; ruleId: string | null; toVersion: number; privateNote: string | null; actor: { name: string } | null }[];
}

interface RuleMetric { ruleId: string; retained: number; overridden: number; overrideRate: number }

const queues: { value: Queue; label: string }[] = [
  { value: 'PENDING_REVIEW', label: 'Pendientes' },
  { value: 'REPORTED', label: 'Reportados' },
  { value: 'APPEALED', label: 'Apelados' },
  { value: 'BLOCKED', label: 'Bloqueados' },
  { value: 'REMOVED', label: 'Removidos' },
];

const reasonOptions: { value: ReasonCode; label: string }[] = [
  { value: 'POLICY_COMPLIANT', label: 'Cumple las normas' },
  { value: 'THREAT', label: 'Amenaza' },
  { value: 'HARASSMENT', label: 'Acoso' },
  { value: 'DISCRIMINATION', label: 'Discriminación' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Insultos u ofensas' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'REPORT_REVIEW', label: 'Reportes vecinales' },
  { value: 'OTHER_POLICY', label: 'Otra norma' },
];

const decisionLabels: Record<Decision, string> = {
  APPROVE: 'Publicar',
  BLOCK: 'Bloquear',
  REMOVE: 'Remover',
  RESTORE: 'Restaurar',
};

const reportLabel = (category: string) => forumReportCategories.find((option) => option.id === category)?.label ?? category;

function defaultReason(item: ModerationItem, decision: Decision): ReasonCode {
  if (decision === 'APPROVE' || decision === 'RESTORE') return 'POLICY_COMPLIANT';
  const reported = item.reports[0]?.category;
  if (reported === 'THREAT' || reported === 'HARASSMENT' || reported === 'DISCRIMINATION' || reported === 'SPAM') return reported;
  return 'INAPPROPRIATE_CONTENT';
}

// Acciones válidas según estado, reportes y apelación; el backend vuelve a validar la transición.
function availableActions(item: ModerationItem, currentUserId?: string): { decision: Decision; label: string; tone: 'positive' | 'danger' | 'info' }[] {
  const ownContent = item.user.id === currentUserId;
  const hasAppeal = item.appeals.length > 0;
  const actions: { decision: Decision; label: string; tone: 'positive' | 'danger' | 'info' }[] = [];

  if (hasAppeal && (item.status === 'BLOCKED' || item.status === 'REMOVED')) {
    if (!ownContent) actions.push({ decision: 'APPROVE', label: 'Aceptar apelación', tone: 'positive' });
    actions.push({ decision: 'BLOCK', label: 'Rechazar apelación', tone: 'danger' });
    return actions;
  }
  if (item.status === 'PENDING_REVIEW' || item.status === 'BLOCKED') {
    if (!ownContent) actions.push({ decision: 'APPROVE', label: 'Publicar', tone: 'positive' });
    if (item.status === 'PENDING_REVIEW') actions.push({ decision: 'BLOCK', label: 'Bloquear', tone: 'danger' });
  }
  if (item.status === 'PUBLISHED' && item.reports.length > 0 && !ownContent) {
    actions.push({ decision: 'APPROVE', label: 'Desestimar reportes', tone: 'info' });
  }
  if (item.status !== 'REMOVED') actions.push({ decision: 'REMOVE', label: 'Remover', tone: 'danger' });
  if (item.status === 'REMOVED' && !ownContent) actions.push({ decision: 'RESTORE', label: 'Restaurar', tone: 'info' });
  return actions;
}

export default function AdminForumQueueScreen() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isModerator = !!user && ['ADMIN', 'EDITOR'].includes(user.role);

  const [target, setTarget] = useState<Target>('THREAD');
  const [queue, setQueue] = useState<Queue>('PENDING_REVIEW');
  const [showMetrics, setShowMetrics] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ item: ModerationItem; decision: Decision } | null>(null);
  const [reasonCode, setReasonCode] = useState<ReasonCode>('POLICY_COMPLIANT');
  const [privateNote, setPrivateNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const queueQuery = useQuery({
    queryKey: ['moderation-forum', target, queue, page],
    queryFn: async () => (await api.get('/moderation/forum', { params: { target, queue, page, limit: 20 } })).data.data as {
      items: ModerationItem[]; total: number; page: number; limit: number;
    },
    enabled: isModerator && !showMetrics,
  });

  const metricsQuery = useQuery({
    queryKey: ['moderation-forum-metrics'],
    queryFn: async () => (await api.get('/moderation/forum/metrics')).data.data as { scope: string; rules: RuleMetric[] },
    enabled: isModerator && showMetrics,
  });

  const decisionMutation = useMutation({
    mutationFn: async () => {
      const { item, decision } = selected!;
      const path = target === 'THREAD' ? `/moderation/forum/threads/${item.id}/decision` : `/moderation/forum/replies/${item.id}/decision`;
      return (await api.post(path, {
        decision,
        reasonCode,
        privateNote: privateNote.trim() || undefined,
        expectedVersion: item.moderationVersion,
        idempotencyKey,
      })).data.data;
    },
    onSuccess: async () => {
      setSelected(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['moderation-forum'] }),
        queryClient.invalidateQueries({ queryKey: ['moderation-forum-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['threads'] }),
        queryClient.invalidateQueries({ queryKey: ['thread-detail'] }),
      ]);
    },
    onError: async (error: any) => {
      // Otra persona pudo decidir antes: se recarga la cola con la versión vigente.
      if (error.response?.status === 409) await queueQuery.refetch();
      Alert.alert('No se pudo registrar', forumErrorMessage(error, 'Actualizá la cola e intentá nuevamente.'));
    },
  });

  const openDecision = (item: ModerationItem, decision: Decision) => {
    setSelected({ item, decision });
    setReasonCode(defaultReason(item, decision));
    setPrivateNote('');
    // Una clave por intento de decisión: reenviar tras un corte de red no la duplica.
    setIdempotencyKey(uuidV4());
  };

  const renderItem = ({ item }: { item: ModerationItem }) => {
    const statusInfo = item.status !== 'PUBLISHED' ? forumStatusInfo[item.status] : null;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Text style={styles.title} numberOfLines={2}>{item.title ?? `Respuesta en «${item.thread?.title}»`}</Text>
          <Text style={styles.version}>v{item.moderationVersion}</Text>
        </View>
        {statusInfo ? (
          <View style={[styles.badge, { backgroundColor: statusInfo.colors.bg }]}>
            <Text style={[styles.badgeText, { color: statusInfo.colors.text }]}>{statusInfo.label}{item.moderationReasonCode ? ` · ${item.moderationReasonCode}` : ''}</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: ClayTheme.states.positive.bg }]}>
            <Text style={[styles.badgeText, { color: ClayTheme.states.positive.text }]}>Publicado</Text>
          </View>
        )}
        <Text style={styles.content} numberOfLines={6}>{item.content}</Text>
        <Text style={styles.meta}>Por {item.user.nickname || item.user.name}</Text>

        {item.reports.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.warning}>{item.reports.length} reporte(s) abiertos</Text>
            {item.reports.slice(0, 3).map((report) => (
              <Text key={report.id} style={styles.sectionText}>• {reportLabel(report.category)}{report.comment ? `: ${report.comment}` : ''}</Text>
            ))}
          </View>
        )}
        {item.appeals[0] && (
          <View style={styles.section}>
            <Text style={styles.appealTitle}>Apelación del autor</Text>
            <Text style={styles.sectionText}>{item.appeals[0].statement}</Text>
          </View>
        )}
        {item.decisions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.historyTitle}>Historial</Text>
            {item.decisions.slice(0, 4).map((entry) => (
              <Text key={entry.id} style={styles.historyText}>
                v{entry.toVersion} · {entry.action}{entry.reasonCode ? ` · ${entry.reasonCode}` : ''}{entry.ruleId ? ` · ${entry.ruleId}` : ''}{entry.actor ? ` · ${entry.actor.name}` : ''}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {availableActions(item, user?.id).map((action) => (
            <TouchableOpacity
              key={`${action.decision}-${action.label}`}
              style={[styles.action, { backgroundColor: ClayTheme.states[action.tone].bg }]}
              onPress={() => openDecision(item, action.decision)}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, { color: ClayTheme.states[action.tone].text }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const data = queueQuery.data;
  const activeQuery = showMetrics ? metricsQuery : queueQuery;

  if (!isModerator) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.empty}>Necesitás rol de editor o administrador.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderación Foro</Text>
        <TouchableOpacity onPress={() => activeQuery.refetch()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Actualizar">
          <MaterialCommunityIcons name="refresh" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={styles.segmented}>
          {(['THREAD', 'REPLY'] as Target[]).map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.segment, !showMetrics && target === value && styles.segmentActive]}
              onPress={() => { setShowMetrics(false); setTarget(value); setPage(1); }}
            >
              <Text style={[styles.segmentText, !showMetrics && target === value && styles.segmentTextActive]}>{value === 'THREAD' ? 'Hilos' : 'Respuestas'}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.segment, showMetrics && styles.segmentActive]} onPress={() => setShowMetrics(true)}>
            <Text style={[styles.segmentText, showMetrics && styles.segmentTextActive]}>Métricas</Text>
          </TouchableOpacity>
        </View>
        {!showMetrics && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {queues.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.tab, queue === option.value && styles.activeTab]}
                onPress={() => { setQueue(option.value); setPage(1); }}
              >
                <Text style={[styles.tabText, queue === option.value && styles.activeTabText]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {showMetrics ? (
        metricsQuery.isLoading ? <ActivityIndicator size="large" color={ClayTheme.colors.primary} style={styles.loader} /> : (
          <FlatList
            data={metricsQuery.data?.rules ?? []}
            keyExtractor={(rule) => rule.ruleId}
            contentContainerStyle={styles.list}
            ListHeaderComponent={<Text style={styles.metricsIntro}>Qué tan seguido una persona del equipo publica contenido que una regla automática retuvo. Una tasa alta sugiere revisar la regla.</Text>}
            renderItem={({ item: rule }) => (
              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <Text style={styles.title}>{rule.ruleId}</Text>
                  <Text style={[styles.rate, rule.overrideRate >= 0.5 && { color: ClayTheme.states.danger.text }]}>{Math.round(rule.overrideRate * 100)}%</Text>
                </View>
                <Text style={styles.meta}>{rule.retained} retenidos · {rule.overridden} revertidos por el equipo</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Todavía no hay retenciones automáticas.</Text>}
          />
        )
      ) : queueQuery.isLoading ? (
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={queueQuery.isRefetching}
          onRefresh={queueQuery.refetch}
          ListEmptyComponent={<Text style={styles.empty}>No hay elementos en esta cola.</Text>}
          ListFooterComponent={data && data.total > data.limit ? (
            <View style={styles.pagination}>
              <ClayButton title="Anterior" variant="secondary" disabled={page === 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
              <Text style={styles.meta}>Página {page}</Text>
              <ClayButton title="Siguiente" variant="secondary" disabled={page * data.limit >= data.total} onPress={() => setPage((value) => value + 1)} />
            </View>
          ) : null}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selected ? decisionLabels[selected.decision] : ''} {target === 'THREAD' ? 'hilo' : 'respuesta'}</Text>
            <Text style={styles.label}>Motivo (lo ve el autor)</Text>
            <View style={styles.reasons}>
              {reasonOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.reason, reasonCode === option.value && styles.reasonActive]}
                  onPress={() => setReasonCode(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reasonCode === option.value }}
                >
                  <Text style={[styles.reasonText, reasonCode === option.value && styles.reasonTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Nota privada (solo el equipo)</Text>
            <TextInput value={privateNote} onChangeText={setPrivateNote} multiline maxLength={2000} style={styles.input} placeholderTextColor={ClayTheme.colors.textMuted} placeholder="Contexto para otras personas del equipo" />
            <View style={styles.modalButtons}>
              <ClayButton title="Cancelar" variant="secondary" onPress={() => setSelected(null)} style={{ flex: 1 }} />
              <ClayButton title="Confirmar" loading={decisionMutation.isPending} disabled={decisionMutation.isPending} onPress={() => decisionMutation.mutate()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevated },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: ClayTheme.colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingTop: 14, gap: 10 },
  segmented: { flexDirection: 'row', marginHorizontal: 20, padding: 4, borderRadius: 999, backgroundColor: ClayTheme.colors.inputBg },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  segmentActive: { backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevatedSm },
  segmentText: { fontFamily: ClayTheme.typography.fontFamily.bold, color: ClayTheme.colors.textMuted },
  segmentTextActive: { color: ClayTheme.colors.text },
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: ClayTheme.colors.inputBg },
  activeTab: { backgroundColor: ClayTheme.colors.primary },
  tabText: { color: ClayTheme.colors.textMuted, fontFamily: ClayTheme.typography.fontFamily.bold },
  activeTabText: { color: ClayTheme.colors.primaryText },
  loader: { marginTop: 50 },
  list: { padding: 20, gap: 16, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: ClayTheme.colors.textMuted, fontFamily: ClayTheme.typography.fontFamily.semiBold },
  card: { backgroundColor: ClayTheme.colors.surface, borderRadius: 20, padding: 18, gap: 10, ...ClayTheme.shadows.elevated },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 16, color: ClayTheme.colors.text },
  version: { color: ClayTheme.colors.textMuted, fontFamily: ClayTheme.typography.fontFamily.semiBold },
  rate: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 12 },
  content: { fontFamily: ClayTheme.typography.fontFamily.medium, color: ClayTheme.colors.textInput, lineHeight: 20 },
  meta: { fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 12, color: ClayTheme.colors.textMuted },
  section: { gap: 3, paddingTop: 8 },
  sectionText: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 13, color: ClayTheme.colors.textInput },
  warning: { color: ClayTheme.states.warning.text, fontFamily: ClayTheme.typography.fontFamily.bold },
  appealTitle: { color: ClayTheme.states.info.text, fontFamily: ClayTheme.typography.fontFamily.bold },
  historyTitle: { fontFamily: ClayTheme.typography.fontFamily.bold, color: ClayTheme.colors.text },
  historyText: { fontSize: 11, color: ClayTheme.colors.textMuted, fontFamily: ClayTheme.typography.fontFamily.medium },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  action: { flexGrow: 1, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
  actionText: { fontFamily: ClayTheme.typography.fontFamily.bold },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  metricsIntro: { fontFamily: ClayTheme.typography.fontFamily.medium, color: ClayTheme.colors.textMuted, lineHeight: 20, marginBottom: 4 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modal: { padding: 24, paddingBottom: 40, backgroundColor: ClayTheme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10 },
  modalTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 21, color: ClayTheme.colors.text, marginBottom: 6 },
  label: { fontFamily: ClayTheme.typography.fontFamily.bold, color: ClayTheme.colors.text },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: ClayTheme.colors.surface },
  reasonActive: { backgroundColor: ClayTheme.colors.primary },
  reasonText: { fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 13, color: ClayTheme.colors.text },
  reasonTextActive: { color: ClayTheme.colors.primaryText },
  input: { backgroundColor: ClayTheme.colors.inputBg, borderRadius: 14, padding: 13, minHeight: 70, color: ClayTheme.colors.text, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
