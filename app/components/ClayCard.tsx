import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ClayTheme } from '../constants/ClayTheme';

interface ClayCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: 'surface' | 'background';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  type?: 'elevated' | 'flat';
}

export const ClayCard: React.FC<ClayCardProps> = ({
  children,
  style,
  color = 'surface',
  padding = 'lg',
  type = 'elevated',
}) => {
  const getBackgroundColor = () => {
    return ClayTheme.colors[color];
  };

  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return 12;
      case 'md': return 18;
      case 'lg': return 24;
      default: return 18;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          padding: getPadding(),
        },
        type === 'elevated' ? ClayTheme.shadows.elevated : {},
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 28, // Clay cards are very round
    marginBottom: ClayTheme.spacing.lg,
  },
});
