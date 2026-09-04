import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { ClayTheme } from '../constants/ClayTheme';
import * as Haptics from 'expo-haptics';

interface ClayButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'flat';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

export const ClayButton: React.FC<ClayButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return ClayTheme.colors.inputBg;
    switch (variant) {
      case 'primary': return ClayTheme.colors.primary;
      case 'secondary': return ClayTheme.colors.secondary;
      case 'accent': return ClayTheme.colors.accent;
      case 'outline': return 'transparent';
      case 'flat': return ClayTheme.colors.surface;
      default: return ClayTheme.colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return ClayTheme.colors.textMuted;
    if (variant === 'primary') return ClayTheme.colors.primaryText;
    if (variant === 'outline') return ClayTheme.colors.text;
    if (variant === 'flat') return ClayTheme.colors.textInput;
    return '#FFFFFF'; // secondary/accent typically have white text in soft designs
  };

  const getElevationStyle = () => {
    if (disabled || variant === 'outline' || variant === 'flat') return {};
    return ClayTheme.shadows.elevated;
  };

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        getElevationStyle(),
        style,
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: ClayTheme.borders.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ClayTheme.spacing.xl,
  },
  text: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 16,
  },
});
