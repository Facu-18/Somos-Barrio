import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ClayTheme } from '../constants/ClayTheme';
import { diffText, hasChanges } from '../lib/textDiff';

type Props = {
  label: string;
  original: string | null;
  value: string;
  onChangeText?: (value: string) => void;
  maxLength?: number;
  tall?: boolean;
};

// Muestra qué cambió la IA respecto del texto original y permite editar la propuesta.
export function AiSuggestionField({ label, original, value, onChangeText, maxLength, tall }: Props) {
  const [mode, setMode] = useState<'diff' | 'edit'>('diff');
  const parts = useMemo(() => diffText(original ?? '', value), [original, value]);
  const changed = hasChanges(parts);

  return (
    <View style={styles.field}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {onChangeText && (
          <View style={styles.segmented}>
            {(['diff', 'edit'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.segment, mode === option && styles.segmentActive]}
                onPress={() => setMode(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === option }}
              >
                <Text style={[styles.segmentText, mode === option && styles.segmentTextActive]}>
                  {option === 'diff' ? 'Cambios' : 'Editar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {mode === 'edit' && onChangeText ? (
        <TextInput
          style={[styles.input, tall && styles.inputTall]}
          multiline
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
        />
      ) : (
        <View style={[styles.diffBox, tall && styles.inputTall]}>
          {changed ? (
            <Text style={styles.diffText}>
              {parts.map((part, index) => (
                <Text
                  key={index}
                  style={part.type === 'added' ? styles.added : part.type === 'removed' ? styles.removed : undefined}
                  accessibilityLabel={part.type === 'equal' ? undefined : `${part.type === 'added' ? 'Agregado' : 'Quitado'}: ${part.text}`}
                >
                  {part.text}
                </Text>
              ))}
            </Text>
          ) : (
            <Text style={styles.unchanged}>Sin cambios respecto del original.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.text },
  segmented: { flexDirection: 'row', backgroundColor: ClayTheme.colors.inputBg, borderRadius: 999, padding: 3 },
  segment: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  segmentActive: { backgroundColor: ClayTheme.colors.surface },
  segmentText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 11, color: ClayTheme.colors.textMuted },
  segmentTextActive: { color: ClayTheme.colors.text },
  input: {
    backgroundColor: ClayTheme.colors.inputBg, borderRadius: 12, padding: 14, minHeight: 90, textAlignVertical: 'top',
    fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 15, color: ClayTheme.colors.textInput,
  },
  inputTall: { minHeight: 180 },
  diffBox: { backgroundColor: ClayTheme.colors.inputBg, borderRadius: 12, padding: 14, minHeight: 90 },
  diffText: { fontFamily: ClayTheme.typography.fontFamily.regular, fontSize: 15, lineHeight: 22, color: ClayTheme.colors.textInput },
  added: { backgroundColor: ClayTheme.states.positive.bg, color: ClayTheme.states.positive.text },
  removed: { backgroundColor: ClayTheme.states.danger.bg, color: ClayTheme.states.danger.text, textDecorationLine: 'line-through' },
  unchanged: { fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 14, color: ClayTheme.colors.textMuted },
});
