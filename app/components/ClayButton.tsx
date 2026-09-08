import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayTheme } from '../constants/ClayTheme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'flat';

interface ClayButtonProps {
  title: string;
  onPress: () => void;
  /**
   * `primary` es la única acción elevada en color. `secondary` es superficie
   * clara elevada. `destructive` va sobre superficie clara con texto de error,
   * nunca como barra roja llena. `flat` no se eleva.
   */
  variant?: Variant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  loading?: boolean;
}

const BACKGROUND: Record<Variant, string> = {
  primary: ClayTheme.colors.primary,
  secondary: ClayTheme.colors.surface,
  destructive: ClayTheme.colors.surface,
  flat: ClayTheme.colors.surfaceFlat,
};

const FOREGROUND: Record<Variant, string> = {
  primary: ClayTheme.colors.primaryText,
  secondary: ClayTheme.colors.textInput,
  destructive: ClayTheme.colors.error,
  flat: ClayTheme.colors.textInput,
};

export const ClayButton: React.FC<ClayButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  style,
  textStyle,
  disabled = false,
  loading = false,
}) => {
  const inactive = disabled || loading;
  const background = inactive ? ClayTheme.colors.inputBg : BACKGROUND[variant];
  const foreground = inactive ? ClayTheme.colors.textFaint : FOREGROUND[variant];

  const elevation = inactive
    ? null
    : variant === 'primary'
      ? styles.shadowPrimary
      : variant === 'flat'
        ? null
        : styles.shadowSurface;

  const composed = [styles.container, { backgroundColor: background }, elevation, style];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <MaterialCommunityIcons name={icon} size={19} color={foreground} />
      ) : null}
      <Text style={[styles.text, { color: foreground }, textStyle]} numberOfLines={1}>
        {title}
      </Text>
    </>
  );

  if (inactive) {
    return (
      <View style={composed} accessibilityRole="button" accessibilityState={{ disabled: true, busy: loading }}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={composed}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: ClayTheme.borders.radiusPill,
    paddingHorizontal: ClayTheme.spacing.lg,
  },
  shadowPrimary: {
    ...ClayTheme.shadows.primary,
  },
  shadowSurface: {
    ...ClayTheme.shadows.elevated,
  },
  text: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 16,
  },
});
