import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayTheme } from '../constants/ClayTheme';

interface ClayInputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Ícono outline a la izquierda, dentro del campo hundido. */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ClayInput = React.forwardRef<TextInput, ClayInputProps>(
  ({ label, error, icon, containerStyle, style, multiline, ...props }, ref) => (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.wrapper, multiline && styles.wrapperMultiline, error ? styles.wrapperError : null]}>
        {icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={19}
            color={error ? ClayTheme.colors.error : ClayTheme.colors.textMuted}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={ClayTheme.colors.textFaint}
          multiline={multiline}
          {...props}
        />
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <MaterialCommunityIcons name="alert-circle-outline" size={15} color={ClayTheme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  ),
);

ClayInput.displayName = 'ClayInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: ClayTheme.spacing.md,
  },
  label: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: ClayTheme.typography.size.label,
    color: ClayTheme.colors.textInput,
    marginBottom: ClayTheme.spacing.sm,
    paddingLeft: ClayTheme.spacing.xs,
  },
  wrapper: {
    minHeight: 56,
    backgroundColor: ClayTheme.colors.inputBg,
    borderRadius: ClayTheme.borders.radiusSunk,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    // Hundido real: sombra interna, no un borde que corra el contenido.
    ...ClayTheme.shadows.sunk,
  },
  wrapperMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  wrapperError: {
    backgroundColor: ClayTheme.colors.errorBg,
    ...ClayTheme.shadows.sunkError,
  },
  icon: {
    marginRight: 11,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: ClayTheme.typography.size.body,
    fontFamily: ClayTheme.typography.fontFamily.medium,
    color: ClayTheme.colors.text,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 96,
    paddingTop: 0,
    textAlignVertical: 'top',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: ClayTheme.spacing.xs,
    paddingLeft: 6,
  },
  errorText: {
    color: ClayTheme.colors.error,
    fontSize: ClayTheme.typography.size.label,
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
  },
});
