import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayTheme } from '../constants/ClayTheme';
import { ClayButton } from './ClayButton';

interface EmptyStateProps {
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Qué pasa, en afirmativo. Sin "Error" ni "No se encontraron resultados". */
  title: string;
  description: string;
  /** Qué hacer. Si no hay acción posible, se omite. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Tres piezas, siempre en este orden: ícono en tile elevado, qué pasa, qué hacer.
 * El bloque se apoya arriba del centro (~30% de la altura): queda más cerca del
 * pulgar y no compite con el header.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container}>
    <View style={styles.iconTile}>
      <MaterialCommunityIcons name={iconName} size={44} color="#A8C3A9" />
    </View>

    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>

    {actionLabel && onAction ? (
      <ClayButton title={actionLabel} onPress={onAction} style={styles.action} />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 72,
    paddingHorizontal: 40,
  },
  iconTile: {
    width: 104,
    height: 104,
    borderRadius: 38,
    backgroundColor: ClayTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: ClayTheme.typography.size.cardTitle,
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    color: ClayTheme.colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 14.5,
    fontFamily: ClayTheme.typography.fontFamily.regular,
    color: ClayTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: ClayTheme.spacing.xs,
  },
});
