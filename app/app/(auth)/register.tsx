import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ClayInput } from '../../components/ClayInput';
import { api, setAccessToken } from '../../lib/api';
import { authStorage } from '../../lib/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFormBottomPadding } from '../../hooks/useTabBarSpace';

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto'),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
const formBottomPadding = useFormBottomPadding();
  const [globalError, setGlobalError] = useState('');
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const response = await api.post('/auth/mobile/register', { ...data, barrioSlug: 'parque-liceo' });
      return response.data.data;
    },
    onSuccess: async (data) => {
      setAccessToken(data.accessToken);
      await authStorage.saveRefreshToken(data.refreshToken);
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
      queryClient.setQueryData(['auth', 'me'], data.user);
      router.replace('/(app)/(tabs)');
    },
    onError: (error: any) => {
      setGlobalError(error.response?.data?.message || 'Error al crear la cuenta.');
    }
  });

  const onSubmit = (data: RegisterForm) => {
    setGlobalError('');
    registerMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: formBottomPadding }]} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="account-plus-outline" size={34} color={ClayTheme.colors.secondary} />
          </View>
          <Text style={styles.title}>Nuevo Vecino</Text>
          <Text style={styles.subtitle}>Unite a tu comunidad</Text>
        </View>

        <View style={styles.formContainer}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Nombre completo"
                placeholder="Mariela Ferrán"
                autoCapitalize="words"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.name?.message}
              
                ref={ref}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Correo"
                placeholder="mariela.ferran@correo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
              
                ref={ref}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Contraseña"
                placeholder="••••••••"
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
              
                ref={ref}
              />
            )}
          />
          
          <ClayButton 
            title={registerMutation.isPending ? "Creando..." : "Crear cuenta"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={registerMutation.isPending}
            style={styles.registerButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tenés cuenta?</Text>
          <Text style={styles.footerLink} onPress={() => router.back()}>
            Entrar
          </Text>
        </View>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClayTheme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
    gap: 16,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 26,
    backgroundColor: ClayTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  title: {
    fontSize: 28,
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    color: ClayTheme.colors.text,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: ClayTheme.typography.fontFamily.medium,
    color: ClayTheme.colors.textMuted,
    marginTop: -5,
  },
  formContainer: {
    paddingTop: 30,
    paddingHorizontal: 30,
  },
  registerButton: {
    marginTop: 18,
  },
  footer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 46,
    paddingTop: 20,
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    fontFamily: ClayTheme.typography.fontFamily.medium,
    color: ClayTheme.colors.textMuted,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    color: ClayTheme.colors.text,
  },
  globalError: {
    color: ClayTheme.colors.error,
    fontSize: 14,
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    textAlign: 'center',
    marginBottom: 16,
  },
  barrioContainer: {
    marginBottom: 10,
    marginTop: 6,
  },
  label: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.textInput,
    marginBottom: 10,
    paddingLeft: 4,
  },
  barrioScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  barrioPill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: ClayTheme.colors.inputBg,
    ...ClayTheme.shadows.sunk, // Use sunk style for unselected to match inputs
  },
  barrioPillActive: {
    backgroundColor: ClayTheme.colors.primary,
    ...ClayTheme.shadows.elevated, // Pop out when selected
  },
  barrioText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 14,
    color: ClayTheme.colors.textMuted,
  },
  barrioTextActive: {
    color: ClayTheme.colors.primaryText,
  },
  errorText: {
    color: ClayTheme.colors.error,
    fontSize: 12,
    fontFamily: ClayTheme.typography.fontFamily.medium,
    marginTop: 6,
    paddingLeft: 4,
  }
});
