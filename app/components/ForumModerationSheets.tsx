import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { uuidV4 } from '../lib/uuid';
import { ForumReportCategory, forumErrorMessage, forumReportCategories } from '../lib/forum';
import { ClayTheme } from '../constants/ClayTheme';
import { ClayButton } from './ClayButton';

export type ForumSheetTarget = { kind: 'thread' | 'reply'; id: string; moderationVersion?: number };

type SheetProps = {
  target: ForumSheetTarget | null;
  basePath: string; // /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId
  onClose: () => void;
  onDone: () => void;
};

const targetPath = (basePath: string, target: ForumSheetTarget) =>
  target.kind === 'thread' ? basePath : `${basePath}/replies/${target.id}`;

const MIN_APPEAL_LENGTH = 20;

export function ForumReportSheet({ target, basePath, onClose, onDone }: SheetProps) {
  const [category, setCategory] = useState<ForumReportCategory | null>(null);
  const [comment, setComment] = useState('');

  const close = () => {
    setCategory(null);
    setComment('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`${targetPath(basePath, target!)}/reports`, {
        category,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
    },
    onSuccess: () => {
      close();
      onDone();
      Alert.alert('Gracias por avisar', 'El equipo de moderación del barrio va a revisar el reporte.');
    },
    onError: (error: any) => {
      Alert.alert('No se pudo enviar', forumErrorMessage(error, 'Intentá nuevamente en unos minutos.'));
    },
  });

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Reportar {target?.kind === 'reply' ? 'respuesta' : 'hilo'}</Text>
          <Text style={styles.subtitle}>¿Qué problema tiene? Tu reporte es anónimo para quien publicó.</Text>

          <View style={styles.options}>
            {forumReportCategories.map((option) => {
              const selected = category === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setCategory(option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Detalles adicionales (opcional)"
            placeholderTextColor={ClayTheme.colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
          />

          <View style={styles.buttons}>
            <ClayButton title="Cancelar" variant="secondary" onPress={close} style={styles.button} />
            <ClayButton
              title="Enviar reporte"
              variant="destructive"
              onPress={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!category || mutation.isPending}
              style={styles.button}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ForumAppealSheet({ target, basePath, onClose, onDone }: SheetProps) {
  const [statement, setStatement] = useState('');
  // Una clave por apelación: reintentar el mismo envío no crea duplicados.
  const [idempotencyKey, setIdempotencyKey] = useState(uuidV4);

  const close = () => {
    setStatement('');
    setIdempotencyKey(uuidV4());
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`${targetPath(basePath, target!)}/appeals`, {
        statement: statement.trim(),
        expectedVersion: target!.moderationVersion ?? 0,
        idempotencyKey,
      });
    },
    onSuccess: () => {
      close();
      onDone();
      Alert.alert('Apelación enviada', 'Otra persona del equipo va a revisar tu caso. Te vas a enterar por el estado de la publicación.');
    },
    onError: (error: any) => {
      if (error.response?.status === 409) onDone();
      Alert.alert('No se pudo apelar', forumErrorMessage(error, 'Intentá nuevamente en unos minutos.'));
    },
  });

  const trimmedLength = statement.trim().length;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Apelar la decisión</Text>
          <Text style={styles.subtitle}>
            Contá por qué creés que tu {target?.kind === 'reply' ? 'respuesta' : 'publicación'} cumple con las normas de convivencia del barrio.
          </Text>

          <TextInput
            style={[styles.input, styles.inputTall]}
            placeholder="Explicá tu caso"
            placeholderTextColor={ClayTheme.colors.textMuted}
            value={statement}
            onChangeText={setStatement}
            multiline
            maxLength={2000}
          />
          <Text style={styles.hint}>
            {trimmedLength < MIN_APPEAL_LENGTH ? `Mínimo ${MIN_APPEAL_LENGTH} caracteres (${trimmedLength}/${MIN_APPEAL_LENGTH})` : `${trimmedLength}/2000`}
          </Text>

          <View style={styles.buttons}>
            <ClayButton title="Cancelar" variant="secondary" onPress={close} style={styles.button} />
            <ClayButton
              title="Enviar apelación"
              onPress={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={trimmedLength < MIN_APPEAL_LENGTH || mutation.isPending}
              style={styles.button}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: ClayTheme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  title: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 21, color: ClayTheme.colors.text },
  subtitle: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, lineHeight: 20, color: ClayTheme.colors.textMuted },
  options: { gap: 8 },
  option: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: ClayTheme.colors.surface },
  optionSelected: { backgroundColor: ClayTheme.states.danger.bg },
  optionText: { fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 14, color: ClayTheme.colors.text },
  optionTextSelected: { color: ClayTheme.states.danger.text, fontFamily: ClayTheme.typography.fontFamily.bold },
  input: {
    backgroundColor: ClayTheme.colors.inputBg,
    borderRadius: 16,
    padding: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    fontFamily: ClayTheme.typography.fontFamily.medium,
    color: ClayTheme.colors.text,
  },
  inputTall: { minHeight: 130 },
  hint: { fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 12, color: ClayTheme.colors.textMuted, textAlign: 'right' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  button: { flex: 1 },
});
