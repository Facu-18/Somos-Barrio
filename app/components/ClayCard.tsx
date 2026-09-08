import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ClayTheme } from '../constants/ClayTheme';

interface ClayCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: 'surface' | 'background' | 'surfaceFlat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /**
   * `elevated` es la unidad de contenido. `flat` es para lo que ya vive dentro
   * de otra superficie: el sistema no anida cards elevadas dentro de cards.
   */
  type?: 'elevated' | 'flat';
}

const PADDING = { none: 0, sm: 12, md: 16, lg: 20 } as const;

export const ClayCard: React.FC<ClayCardProps> = ({
  children,
  style,
  color = 'surface',
  padding = 'lg',
  type = 'elevated',
}) => (
  <View
    style={[
      styles.card,
      { backgroundColor: ClayTheme.colors[color], padding: PADDING[padding] },
      type === 'elevated' && styles.elevated,
      style,
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: ClayTheme.borders.radiusElevated,
    marginBottom: ClayTheme.spacing.md,
  },
  elevated: {
    ...ClayTheme.shadows.elevated,
  },
});
