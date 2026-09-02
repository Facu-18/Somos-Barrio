import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { ClayInput } from '../../../components/ClayInput';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Reply {
  id: string;
  content: string;
  createdAt: string;
  upVotes: number;
  user: {
    name: string;
  };
}

export default function ThreadDetailScreen() {
  const { id, subforumSlug } = useLocalSearchParams<{ id: string, subforumSlug: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user?.barrio?.slug || 'palermo';
  const queryClient = useQueryClient();

  const [replyContent, setReplyContent] = useState('');

  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread-detail', barrioSlug, subforumSlug, id],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${id}`);
      return response.data.data;
    },
    enabled: !!id && !!subforumSlug && !!user,
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post(`/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${id}/replies`, { content });
      return response.data.data;
    },
    onSuccess: () => {
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['thread-detail', barrioSlug, subforumSlug, id] });
    },
    onError: (err) => {
      alert('Error al enviar respuesta');
    }
  });

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate(replyContent);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || 'XX';

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

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{thread.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Original Post */}
        <View style={styles.originalPost}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(thread.user?.name)}</Text>
            </View>
            <View>
              <Text style={styles.authorName}>{thread.user?.name}</Text>
              <Text style={styles.timeAgo}>{formatDate(thread.createdAt)}</Text>
            </View>
          </View>
          
          <Text style={styles.threadTitle}>{thread.title}</Text>
          <Text style={styles.threadContent}>{thread.content}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="arrow-up-bold-outline" size={18} color={ClayTheme.colors.textMuted} />
              <Text style={styles.statText}>{thread.upVotes || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="comment-text-outline" size={18} color={ClayTheme.colors.textMuted} />
              <Text style={styles.statText}>{thread.replies?.length || 0} respuestas</Text>
            </View>
          </View>
        </View>

        {/* Replies */}
        <View style={styles.repliesSection}>
          {thread.replies?.map((reply: Reply) => (
            <View key={reply.id} style={styles.replyCard}>
              <View style={styles.replyAuthorRow}>
                <View style={[styles.avatar, styles.replyAvatar]}>
                  <Text style={styles.replyAvatarText}>{getInitials(reply.user?.name)}</Text>
                </View>
                <View>
                  <Text style={styles.replyAuthorName}>{reply.user?.name}</Text>
                  <Text style={styles.timeAgo}>{formatDate(reply.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.replyContent}>{reply.content}</Text>
            </View>
          ))}
          
          {(!thread.replies || thread.replies.length === 0) && (
            <Text style={styles.emptyRepliesText}>Sé el primero en responder.</Text>
          )}
        </View>
      </ScrollView>

      {/* Reply Input Area */}
      <View style={styles.inputArea}>
        <View style={styles.inputWrapper}>
          <ClayInput 
            placeholder="Escribí una respuesta..."
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
    borderTopColor: 'rgba(0,0,0,0.05)',
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
    paddingHorizontal: 22,
    gap: 16,
  },
  replyCard: {
    backgroundColor: ClayTheme.colors.surface,
    padding: 20,
    borderRadius: 24,
    ...ClayTheme.shadows.elevated,
  },
  replyAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  replyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E1EFE2',
  },
  replyAvatarText: {
    fontSize: 13,
    color: '#35663A',
  },
  replyAuthorName: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.text,
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
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: ClayTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  replyInput: {
    minHeight: 50,
    maxHeight: 120,
    paddingTop: 14,
    marginBottom: 0, // Override default margin
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ClayTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
    marginBottom: 4, // Align with input
  },
  sendButtonDisabled: {
    backgroundColor: ClayTheme.colors.textMuted,
    opacity: 0.5,
  }
});
