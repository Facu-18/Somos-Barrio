import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminMarketQueueScreen() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [decisionType, setDecisionType] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState('');
  const [privateNote, setPrivateNote] = useState('');

  const { data: moderationData, isLoading } = useQuery({
    queryKey: ['moderation-marketplace', user?.barrio?.slug],
    queryFn: async () => {
      // Pedimos las pendientes de revisión
      const response = await api.get('/moderation/marketplace', {
        params: {
          barrioSlug: user?.barrio?.slug,
          status: 'PENDING_REVIEW'
        }
      });
      return response.data.data;
    },
    enabled: !!user?.barrio?.slug && (user.role === 'ADMIN' || user.role === 'EDITOR'),
  });

  const moderateMutation = useMutation({
    mutationFn: async (data: { postId: string, decision: string, reason: string, privateNote?: string }) => {
      const response = await api.post(`/moderation/marketplace/${data.postId}/decision`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-marketplace'] });
      Alert.alert('Éxito', 'Decisión registrada correctamente.');
      setDecisionModalVisible(false);
      setSelectedPost(null);
      setDecisionReason('');
      setPrivateNote('');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Hubo un error al registrar la decisión.');
    }
  });

  const openDecisionModal = (post: any, type: string) => {
    setSelectedPost(post);
    setDecisionType(type);
    setDecisionModalVisible(true);
  };

  const submitDecision = () => {
    if (!decisionReason.trim()) {
      Alert.alert('Error', 'Por favor ingresa una razón o mensaje.');
      return;
    }
    moderateMutation.mutate({
      postId: selectedPost.id,
      decision: decisionType,
      reason: decisionReason,
      privateNote: privateNote
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <Text style={styles.postTitle}>{item.title}</Text>
      <Text style={styles.postDescription} numberOfLines={3}>{item.description}</Text>
      <View style={styles.postMeta}>
        <Text style={styles.metaText}>Por: {item.user?.nickname || item.user?.name}</Text>
        <Text style={styles.metaText}>Precio: ${item.price}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => openDecisionModal(item, 'APPROVE')}>
          <MaterialCommunityIcons name="check" size={20} color="white" />
          <Text style={styles.actionBtnText}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => openDecisionModal(item, 'REJECT')}>
          <MaterialCommunityIcons name="close" size={20} color="white" />
          <Text style={styles.actionBtnText}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderación Market</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={moderationData?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay publicaciones pendientes.</Text>}
        />
      )}

      {/* Decision Modal */}
      <Modal visible={decisionModalVisible} transparent animationType="slide" onRequestClose={() => setDecisionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {decisionType === 'APPROVE' ? 'Aprobar Publicación' : 'Rechazar Publicación'}
            </Text>

            <Text style={styles.inputLabel}>Razón (Visible al usuario):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Cumple las normas / No permitido"
              value={decisionReason}
              onChangeText={setDecisionReason}
              multiline
            />

            <Text style={styles.inputLabel}>Nota Privada (Solo Admins):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Notas internas..."
              value={privateNote}
              onChangeText={setPrivateNote}
              multiline
            />

            <View style={styles.modalButtons}>
              <ClayButton title="Cancelar" onPress={() => setDecisionModalVisible(false)} variant="secondary" style={{ flex: 1, marginRight: 8 }} />
              <ClayButton
                title="Confirmar"
                onPress={submitDecision}
                loading={moderateMutation.isPending}
                style={{ flex: 1, backgroundColor: decisionType === 'APPROVE' ? ClayTheme.colors.primary : ClayTheme.colors.error }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClayTheme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 20, backgroundColor: ClayTheme.colors.surface, ...ClayTheme.shadows.elevated },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: ClayTheme.colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text },
  listContent: { padding: 20, gap: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, fontFamily: ClayTheme.typography.fontFamily.medium, color: ClayTheme.colors.textMuted },
  postCard: { backgroundColor: ClayTheme.colors.surface, borderRadius: 20, padding: 20, ...ClayTheme.shadows.elevated },
  postTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text, marginBottom: 8 },
  postDescription: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, color: ClayTheme.colors.textMuted, marginBottom: 12 },
  postMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 12, color: ClayTheme.colors.primaryText },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 8 },
  approveBtn: { backgroundColor: '#22c55e' },
  rejectBtn: { backgroundColor: '#ef4444' },
  actionBtnText: { fontFamily: ClayTheme.typography.fontFamily.bold, color: 'white', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: ClayTheme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 22, color: ClayTheme.colors.text, marginBottom: 20 },
  inputLabel: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 14, color: ClayTheme.colors.text, marginBottom: 8 },
  modalInput: { backgroundColor: ClayTheme.colors.surface, borderRadius: 16, padding: 16, height: 80, textAlignVertical: 'top', fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 15, color: ClayTheme.colors.text, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }
});
