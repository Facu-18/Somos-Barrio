import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClayTheme } from '../constants/ClayTheme';
import { ClayButton } from './ClayButton';

export type TimeValue = { hour: number; minute: number };

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

export const formatTime = (time: TimeValue | null) =>
  time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '';

type Props = {
  visible: boolean;
  value: TimeValue | null;
  onConfirm: (value: TimeValue) => void;
  onClose: () => void;
};

/**
 * Selector de hora sin teclado: se toca la hora y los minutos. Evita que el usuario tenga que
 * saber que el formato es HH:MM (el teclado numérico no tiene ":" y "18.30" no es válido).
 */
export function TimePickerModal({ visible, value, onConfirm, onClose }: Props) {
  const [hour, setHour] = useState<number | null>(value?.hour ?? null);
  const [minute, setMinute] = useState<number>(value?.minute ?? 0);

  useEffect(() => {
    if (visible) {
      setHour(value?.hour ?? null);
      setMinute(value?.minute ?? 0);
    }
  }, [visible, value]);

  const preview = hour === null ? '--:--' : formatTime({ hour, minute });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Hora del evento</Text>
          <Text style={styles.preview} accessibilityLiveRegion="polite">{preview}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.label}>Hora</Text>
            <View style={styles.grid}>
              {HOURS.map((option) => {
                const selected = option === hour;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.cell, styles.hourCell, selected && styles.cellSelected]}
                    onPress={() => setHour(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option} horas`}
                  >
                    <Text style={[styles.cellText, selected && styles.cellTextSelected]}>{String(option).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Minutos</Text>
            <View style={styles.grid}>
              {MINUTES.map((option) => {
                const selected = option === minute;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.cell, styles.minuteCell, selected && styles.cellSelected]}
                    onPress={() => setMinute(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option} minutos`}
                  >
                    <Text style={[styles.cellText, selected && styles.cellTextSelected]}>:{String(option).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <ClayButton title="Cancelar" variant="secondary" onPress={onClose} style={styles.action} />
            <ClayButton
              title="Listo"
              onPress={() => hour !== null && onConfirm({ hour, minute })}
              disabled={hour === null}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { maxHeight: '90%', backgroundColor: ClayTheme.colors.surface, borderRadius: 28, padding: 20, ...ClayTheme.shadows.elevated },
  title: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 18, color: ClayTheme.colors.text, textAlign: 'center' },
  preview: { fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 40, color: ClayTheme.colors.primaryText, textAlign: 'center', marginVertical: 8 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
  label: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 13, color: ClayTheme.colors.textMuted, marginTop: 10, marginBottom: 8 },
  // Filas completas (24 horas = 4×6, 12 minutos = 3×4): space-between reparte el espacio sin desbordar en pantallas angostas.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  cell: { height: 44, borderRadius: 14, backgroundColor: ClayTheme.colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  hourCell: { width: '15.5%' },
  minuteCell: { width: '23.5%' },
  cellSelected: { backgroundColor: ClayTheme.colors.primary },
  cellText: { fontFamily: ClayTheme.typography.fontFamily.bold, fontSize: 15, color: ClayTheme.colors.text },
  cellTextSelected: { color: ClayTheme.colors.primaryText },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: { flex: 1 },
});
