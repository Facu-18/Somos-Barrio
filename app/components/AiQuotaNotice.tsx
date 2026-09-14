import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayTheme } from '../constants/ClayTheme';
import type { AiQuotaStatus } from '../hooks/useAiQuota';

const formatReset = (iso: string) => {
  const reset = new Date(iso);
  const time = reset.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const isToday = reset.toDateString() === new Date().toDateString();
  return isToday ? `hoy a las ${time}` : `mañana a las ${time}`;
};

type Props = { quota?: AiQuotaStatus; isPending?: boolean; isLoading?: boolean };

export function AiQuotaNotice({ quota, isPending, isLoading }: Props) {
  let icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = 'auto-fix';
  let tone: { bg: string; text: string } = ClayTheme.states.info;
  let message: string;

  if (isPending || quota?.requestInProgress) {
    icon = 'timer-sand';
    message = 'Generando una sugerencia. Puede tardar hasta un minuto…';
  } else if (isLoading) {
    message = 'Consultando tus mejoras disponibles…';
  } else if (!quota) {
    tone = ClayTheme.states.warning;
    message = 'No pudimos consultar tus mejoras con IA. Probá de nuevo en un rato.';
  } else if (!quota.enabled) {
    icon = 'pause-circle-outline';
    tone = ClayTheme.states.neutral;
    message = 'La asistencia con IA está pausada temporalmente.';
  } else if (quota.remaining === 0) {
    icon = 'clock-outline';
    tone = ClayTheme.states.warning;
    message = `Usaste tus ${quota.dailyLimit} mejoras de hoy. Se renuevan ${formatReset(quota.resetsAt)}.`;
  } else {
    message = `Te quedan ${quota.remaining} de ${quota.dailyLimit} mejoras hoy. Repetir el mismo texto no descuenta.`;
  }

  return (
    <View style={[styles.notice, { backgroundColor: tone.bg }]} accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name={icon} size={16} color={tone.text} />
      <Text style={[styles.text, { color: tone.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  text: { flex: 1, fontFamily: ClayTheme.typography.fontFamily.semiBold, fontSize: 12, lineHeight: 17 },
});
