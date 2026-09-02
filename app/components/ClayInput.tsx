import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { ClayTheme } from '../constants/ClayTheme';

interface ClayInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ClayInput: React.FC<ClayInputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputWrapper,
        error ? styles.inputWrapperError : null,
      ]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={ClayTheme.colors.textMuted}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: ClayTheme.spacing.md,
  },
  label: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.textInput,
    marginBottom: ClayTheme.spacing.sm,
    paddingLeft: ClayTheme.spacing.xs,
  },
  inputWrapper: {
    height: 56,
    backgroundColor: ClayTheme.colors.inputBg,
    borderRadius: ClayTheme.borders.radiusSunk,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...ClayTheme.shadows.sunk, // simulate inner shadow via borders
  },
  inputWrapperError: {
    backgroundColor: ClayTheme.colors.errorBg,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderWidth: 1,
    borderColor: ClayTheme.colors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: 18,
    fontSize: 17,
    fontFamily: ClayTheme.typography.fontFamily.bold,
    color: ClayTheme.colors.text,
  },
  errorText: {
    color: ClayTheme.colors.error,
    fontSize: 12,
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    marginTop: ClayTheme.spacing.xs,
    paddingLeft: ClayTheme.spacing.xs,
  },
});
