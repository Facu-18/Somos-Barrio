import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayInput } from '../../../components/ClayInput';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForumAppeal, ForumContentStatus, canAppealForumContent, canEditForumContent, forumErrorMessage, forumModerationMessage, forumStatusInfo } from '../../../lib/forum';
import { ForumAppealSheet, ForumReportSheet, ForumSheetTarget } from '../../../components/ForumModerationSheets';

interface Reply {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  upVotes: number;
  parentReplyId: string | null;
  status: ForumContentStatus;
  moderationReasonCode: string | null;
  moderationVersion: number;
  appeals?: ForumAppeal[];
  user: {
    name: string;
    nickname?: string;
    avatarUrl?: string;
  };
}

interface ReplyNode extends Reply {
  children: ReplyNode[];
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name?: string | null) => (name?.trim()?.slice(0, 2) || '?').toUpperCase();

type ModerationNoticeProps = {
  status: ForumContentStatus;
  reasonCode: string | null;
  isOwn: boolean;
  pendingAppeal?: ForumAppeal;
  onEdit?: () => void;
  onAppeal?: () => void;
};

// Solo el autor (o moderación) recibe contenido no publicado; se marca con su estado.
const ModerationNotice = ({ status, reasonCode, isOwn, pendingAppeal, onEdit, onAppeal }: ModerationNoticeProps) => {
  if (status === 'PUBLISHED') return null;
  const info = forumStatusInfo[status];
  return (
    <View style={[styles.moderationNotice, { backgroundColor: info.colors.bg }]} accessibilityRole="summary">
      <View style={styles.moderationNoticeHeader}>
        <MaterialCommunityIcons name={info.icon} size={16} color={info.colors.text} />
        <Text style={[styles.moderationNoticeTitle, { color: info.colors.text }]}>{info.label}</Text>
        <View style={styles.moderationActions}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.moderationEditBtn} accessibilityRole="button" accessibilityLabel="Editar para corregir">
              <MaterialCommunityIcons name="pencil-outline" size={14} color={info.colors.text} />
              <Text style={[styles.moderationNoticeTitle, { color: info.colors.text }]}>Editar</Text>
            </TouchableOpacity>
          )}
          {onAppeal && !pendingAppeal && (
            <TouchableOpacity onPress={onAppeal} style={styles.moderationEditBtn} accessibilityRole="button" accessibilityLabel="Apelar la decisión">
              <MaterialCommunityIcons name="scale-balance" size={14} color={info.colors.text} />
              <Text style={[styles.moderationNoticeTitle, { color: info.colors.text }]}>Apelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {isOwn && <Text style={[styles.moderationNoticeText, { color: info.colors.text }]}>{forumModerationMessage(status, reasonCode)}</Text>}
      {isOwn && pendingAppeal && (
        <Text style={[styles.moderationNoticeText, styles.moderationAppealText, { color: info.colors.text }]}>
          Tu apelación está en revisión.
        </Text>
      )}
    </View>
  );
};

type ReplyItemProps = {
  reply: ReplyNode;
  highlightedReplyId?: string;
  depth?: number;
  onReply: (id: string, name: string) => void;
  onEdit: (reply: Reply) => void;
  onReport: (reply: Reply) => void;
  onAppeal: (reply: Reply) => void;
  currentUserId?: string;
  isClosed?: boolean;
};

const ReplyItem = ({ reply, highlightedReplyId, depth = 0, onReply, onEdit, onReport, onAppeal, currentUserId, isClosed = false }: ReplyItemProps) => {
  const visualDepth = Math.min(depth, 3);
  const paddingLeft = visualDepth * 16;
  const isPublished = reply.status === 'PUBLISHED';
  const isOwn = reply.userId === currentUserId;
  const canEdit = isOwn && canEditForumContent(reply.status) && !isClosed;

  return (
    <View style={{ paddingLeft, marginBottom: 16 }}>
      <View
        style={[styles.replyCard, depth > 0 && styles.replyCardNested, reply.id === highlightedReplyId && styles.replyCardHighlighted]}
        accessibilityLabel={reply.id === highlightedReplyId ? 'Respuesta mencionada en la notificación' : undefined}
      >
        <View style={styles.replyHeader}>
          <View style={styles.replyAuthorRow}>
            <View style={[styles.avatar, styles.replyAvatar]}>
              {reply.user?.avatarUrl ? (
                <Image source={{ uri: reply.user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.replyAvatarText}>{getInitials(reply.user?.name)}</Text>
              )}
            </View>
            <View>
              <Text style={styles.replyAuthorName}>{reply.user?.nickname || reply.user?.name}</Text>
              <Text style={styles.timeAgo}>{formatDate(reply.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.replyActions}>
            {isPublished && !isOwn && (
              <TouchableOpacity
                style={styles.replyReportBtn}
                onPress={() => onReport(reply)}
                accessibilityRole="button"
                accessibilityLabel={`Reportar respuesta de ${reply.user?.nickname || reply.user?.name}`}
              >
                <MaterialCommunityIcons name="flag-outline" size={16} color={ClayTheme.colors.textMuted} />
              </TouchableOpacity>
            )}
            {!isClosed && isPublished && (
              <TouchableOpacity
                style={styles.replyActionBtn}
                onPress={() => onReply(reply.id, reply.user?.nickname || reply.user?.name)}
                accessibilityRole="button"
                accessibilityLabel={`Responder a ${reply.user?.nickname || reply.user?.name}`}
              >
                <MaterialCommunityIcons name="reply" size={16} color={ClayTheme.colors.primary} />
                <Text style={styles.replyActionText}>Responder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.replyContent}>{reply.content}</Text>
        <ModerationNotice
          status={reply.status}
          reasonCode={reply.moderationReasonCode}
          isOwn={isOwn}
          pendingAppeal={reply.appeals?.[0]}
          onEdit={canEdit ? () => onEdit(reply) : undefined}
          onAppeal={isOwn && canAppealForumContent(reply.status) ? () => onAppeal(reply) : undefined}
        />
      </View>

      {reply.children.map(child => (
        <ReplyItem key={child.id} reply={child} highlightedReplyId={highlightedReplyId} depth={depth + 1} onReply={onReply} onEdit={onEdit} onReport={onReport} onAppeal={onAppeal} currentUserId={currentUserId} isClosed={isClosed} />
      ))}
    </View>
  );
};

export default function ThreadDetailScreen() {
  const { id, subforumSlug, replyId } = useLocalSearchParams<{ id: string; subforumSlug: string; replyId?: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<{id: string, name: string} | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ForumSheetTarget | null>(null);
  const [appealTarget, setAppealTarget] = useState<ForumSheetTarget | null>(null);
  const threadPath = `/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${id}`;

  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread-detail', barrioSlug, subforumSlug, id],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${id}`);
      return response.data.data;
    },
    enabled: !!id && !!subforumSlug && !!user,
  });

  const refreshThread = () => {
    queryClient.invalidateQueries({ queryKey: ['thread-detail', barrioSlug, subforumSlug, id] });
    queryClient.invalidateQueries({ queryKey: ['threads', barrioSlug, subforumSlug] });
  };

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const basePath = `/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${id}/replies`;
      if (editingReplyId) {
        const response = await api.patch(`${basePath}/${editingReplyId}`, { content });
        return response.data.data as Reply;
      }
      const payload: { content: string; parentReplyId?: string } = { content };
      if (replyingTo) {
        payload.parentReplyId = replyingTo.id;
      }
      const response = await api.post(basePath, payload);
      return response.data.data as Reply;
    },
    onSuccess: (reply) => {
      setReplyContent('');
      setReplyingTo(null);
      setEditingReplyId(null);
      refreshThread();
      if (reply.status !== 'PUBLISHED') {
        Alert.alert(
          reply.status === 'BLOCKED' ? 'No se publicó tu respuesta' : 'Tu respuesta quedó en revisión',
          forumModerationMessage(reply.status, reply.moderationReasonCode)
        );
      }
    },
    onError: (error: any) => {
      // Si el hilo o el padre cambiaron de estado, la pantalla debe reflejarlo.
      if (error.response?.status === 409) refreshThread();
      Alert.alert('Error', forumErrorMessage(error, 'Error al enviar respuesta'));
    }
  });

  const startEditingReply = (reply: Reply) => {
    setReplyingTo(null);
    setEditingReplyId(reply.id);
    setReplyContent(reply.content);
  };

  const cancelComposerContext = () => {
    if (editingReplyId) setReplyContent('');
    setReplyingTo(null);
    setEditingReplyId(null);
  };

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate(replyContent);
  };

  const closeThreadMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${id}/close`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-detail', barrioSlug, subforumSlug, id] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Error al cerrar el hilo');
    }
  });

  const handleCloseThread = () => {
    Alert.alert(
      "Cerrar Hilo",
      "¿Estás seguro que querés cerrar este hilo? Ya no se podrán publicar más respuestas y esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Cerrar", style: "destructive", onPress: () => closeThreadMutation.mutate() }
      ]
    );
  };

  const buildReplyTree = (replies: Reply[] = []): ReplyNode[] => {
    const map = new Map<string, ReplyNode>();
    const roots: ReplyNode[] = [];
    
    replies.forEach(r => map.set(r.id, { ...r, children: [] }));
    
    replies.forEach(r => {
      if (r.parentReplyId) {
        const parent = map.get(r.parentReplyId);
        if (parent) {
          parent.children.push(map.get(r.id)!);
        } else {
          // Fallback if parent missing for some reason
          roots.push(map.get(r.id)!);
        }
      } else {
        roots.push(map.get(r.id)!);
      }
    });
    
    return roots;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontFamily: ClayTheme.typography.fontFamily.bold, color: ClayTheme.colors.error }}>Hilo no encontrado</Text>
      </View>
    );
  }

  const replyTree = buildReplyTree(thread.replies);
  const threadStatus: ForumContentStatus = thread.status ?? 'PUBLISHED';
  const isThreadAuthor = thread.userId === user?.id;
  const acceptsReplies = threadStatus === 'PUBLISHED' && !thread.isClosed;
  const composerContextName = editingReplyId ? null : replyingTo?.name;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{thread.title}</Text>
        {threadStatus === 'PUBLISHED' && !isThreadAuthor && (
          <TouchableOpacity
            onPress={() => setReportTarget({ kind: 'thread', id: thread.id })}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Reportar hilo"
          >
            <MaterialCommunityIcons name="flag-outline" size={22} color={ClayTheme.colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Original Post */}
        <View style={styles.originalPost}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              {thread.user?.avatarUrl ? (
                <Image source={{ uri: thread.user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{getInitials(thread.user?.name)}</Text>
              )}
            </View>
            <View>
              <Text style={styles.authorName}>{thread.user?.nickname || thread.user?.name}</Text>
              <Text style={styles.timeAgo}>{formatDate(thread.createdAt)}</Text>
            </View>
          </View>
          
          <Text style={styles.threadTitle}>{thread.title}</Text>
          <Text style={styles.threadContent}>{thread.content}</Text>

          <ModerationNotice
            status={threadStatus}
            reasonCode={thread.moderationReasonCode}
            isOwn={isThreadAuthor}
            pendingAppeal={thread.appeals?.[0]}
            onEdit={isThreadAuthor && canEditForumContent(threadStatus)
              ? () => router.push({ pathname: '/(app)/create-thread', params: { subforumSlug, threadId: thread.id } })
              : undefined}
            onAppeal={isThreadAuthor && canAppealForumContent(threadStatus)
              ? () => setAppealTarget({ kind: 'thread', id: thread.id, moderationVersion: thread.moderationVersion })
              : undefined}
          />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="arrow-up-bold-outline" size={18} color={ClayTheme.colors.textMuted} />
              <Text style={styles.statText}>{thread.upVotes || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="comment-text-outline" size={18} color={ClayTheme.colors.textMuted} />
              <Text style={styles.statText}>{thread._count?.replies ?? thread.replies?.length ?? 0} respuestas</Text>
            </View>
            {(thread.userId === user?.id || user?.role === 'ADMIN' || user?.role === 'EDITOR') && !thread.isClosed && (
              <TouchableOpacity style={[styles.statItem, { marginLeft: 'auto' }]} onPress={handleCloseThread} disabled={closeThreadMutation.isPending}>
                <MaterialCommunityIcons name="lock-outline" size={18} color={ClayTheme.colors.error} />
                <Text style={[styles.statText, { color: ClayTheme.colors.error }]}>
                  {closeThreadMutation.isPending ? "Cerrando..." : "Cerrar hilo"}
                </Text>
              </TouchableOpacity>
            )}
            {thread.isClosed && (
              <View style={[styles.statItem, { marginLeft: 'auto' }]}>
                <MaterialCommunityIcons name="lock" size={18} color={ClayTheme.colors.textMuted} />
                <Text style={styles.statText}>Cerrado</Text>
              </View>
            )}
          </View>
        </View>

        {/* Replies */}
        <View style={styles.repliesSection}>
          {replyTree.map(node => (
            <ReplyItem
              key={node.id}
              reply={node}
              highlightedReplyId={replyId}
              onReply={(replyId, name) => { setEditingReplyId(null); setReplyingTo({id: replyId, name}); }}
              onEdit={startEditingReply}
              onReport={(reply) => setReportTarget({ kind: 'reply', id: reply.id })}
              onAppeal={(reply) => setAppealTarget({ kind: 'reply', id: reply.id, moderationVersion: reply.moderationVersion })}
              currentUserId={user?.id}
              isClosed={thread.isClosed}
            />
          ))}
          
          {replyTree.length === 0 && (
            <Text style={styles.emptyRepliesText}>Sé el primero en responder.</Text>
          )}
        </View>
      </ScrollView>

      {/* Contextual Input Area */}
      {!acceptsReplies ? (
        <View style={[styles.closedBanner, { paddingBottom: insets.bottom + 16 }]}>
            <MaterialCommunityIcons name={thread.isClosed ? 'lock' : 'clock-outline'} size={20} color={ClayTheme.colors.textMuted} />
            <Text style={styles.closedBannerText}>
              {thread.isClosed ? 'Este hilo está cerrado a nuevas respuestas.' : 'Las respuestas se habilitan cuando el hilo esté publicado.'}
            </Text>
        </View>
      ) : (
        <View style={[styles.inputContainerWrapper, { paddingBottom: insets.bottom }]}>
          {(editingReplyId || composerContextName) && (
            <View style={styles.replyContextBanner}>
              {editingReplyId ? (
                <Text style={styles.replyContextText}>Editando tu respuesta</Text>
              ) : (
                <Text style={styles.replyContextText}>Respondiendo a <Text style={{fontFamily: ClayTheme.typography.fontFamily.bold}}>{composerContextName}</Text></Text>
              )}
              <TouchableOpacity onPress={cancelComposerContext} style={styles.replyContextClose} accessibilityRole="button" accessibilityLabel="Cancelar">
                <MaterialCommunityIcons name="close" size={18} color={ClayTheme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <ClayInput
                placeholder={editingReplyId ? "Corregí tu respuesta..." : replyingTo ? "Escribí tu respuesta..." : "Comentar en el hilo..."}
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
                style={styles.replyInput}
              />
            </View>
            <TouchableOpacity 
              style={[styles.sendButton, !replyContent.trim() && styles.sendButtonDisabled]} 
              onPress={handleSendReply}
              disabled={!replyContent.trim() || replyMutation.isPending}
            >
              {replyMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ForumReportSheet target={reportTarget} basePath={threadPath} onClose={() => setReportTarget(null)} onDone={refreshThread} />
      <ForumAppealSheet target={appealTarget} basePath={threadPath} onClose={() => setAppealTarget(null)} onDone={refreshThread} />
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 16,
    color: ClayTheme.colors.text,
  },
  content: {
    paddingBottom: 40,
  },
  originalPost: {
    padding: 24,
    backgroundColor: ClayTheme.colors.surface,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...ClayTheme.shadows.elevated,
    marginBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EAE7F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  avatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 16,
    color: '#57508A',
  },
  authorName: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 15,
    color: ClayTheme.colors.text,
  },
  timeAgo: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  threadTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 22,
    color: ClayTheme.colors.text,
    lineHeight: 28,
    marginBottom: 12,
  },
  threadContent: {
    fontFamily: ClayTheme.typography.fontFamily.regular,
    fontSize: 15,
    color: ClayTheme.colors.textInput,
    lineHeight: 22,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ClayTheme.colors.divider,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
  },
  repliesSection: {
    paddingHorizontal: 16,
  },
  replyCard: {
    backgroundColor: ClayTheme.colors.surface,
    padding: 16,
    borderRadius: 20,
    ...ClayTheme.shadows.elevated,
  },
  replyCardNested: {
    borderRadius: ClayTheme.borders.radiusSunk,
    padding: 14,
    backgroundColor: ClayTheme.colors.surfaceFlat,
    ...ClayTheme.shadows.none,
  },
  replyCardHighlighted: {
    backgroundColor: ClayTheme.states.warning.bg,
    ...ClayTheme.shadows.elevated,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  replyAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E1EFE2',
  },
  replyAvatarText: {
    fontSize: 12,
    color: '#35663A',
  },
  replyAuthorName: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.text,
  },
  replyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ClayTheme.colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  replyActionText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 11,
    color: ClayTheme.colors.primary,
  },
  replyContent: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 14,
    color: ClayTheme.colors.textInput,
    lineHeight: 20,
  },
  emptyRepliesText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  inputContainerWrapper: {
    backgroundColor: ClayTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: ClayTheme.colors.divider,
  },
  replyContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  replyContextText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 12,
    color: ClayTheme.colors.textMuted,
  },
  replyContextClose: {
    padding: 4,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: 16,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  replyInput: {
    minHeight: 50,
    maxHeight: 120,
    paddingTop: 14,
    marginBottom: 0,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ClayTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: ClayTheme.colors.textMuted,
    opacity: 0.5,
  },
  closedBanner: {
    backgroundColor: ClayTheme.colors.surface,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: ClayTheme.colors.divider,
  },
  closedBannerText: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
  },
  moderationNotice: {
    borderRadius: ClayTheme.borders.radiusSunk,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    gap: 4,
  },
  moderationNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moderationNoticeTitle: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
  },
  moderationNoticeText: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  moderationActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 4,
  },
  moderationAppealText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyReportBtn: {
    padding: 4,
  },
  moderationEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
