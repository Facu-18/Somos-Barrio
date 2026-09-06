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

const loginSchema = z.object({
  email: z.string().email('Ese correo no parece válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [globalError, setGlobalError] = useState('');
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await api.post('/auth/mobile/login', data);
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
      setGlobalError(error.response?.data?.message || 'Error al iniciar sesión. Intenta nuevamente.');
    }
  });

  const onSubmit = (data: LoginForm) => {
    setGlobalError('');
    loginMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Clay Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="leaf" size={34} color={ClayTheme.colors.primary} />
          </View>
          <Text style={styles.title}>Somos Barrio</Text>
          <Text style={styles.subtitle}>Tu barrio, más cerca</Text>
        </View>

        <View style={styles.formContainer}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

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

          <View style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
          </View>

          <ClayButton 
            title={loginMutation.isPending ? "Entrando..." : "Entrar"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={loginMutation.isPending}
            style={styles.loginButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Todavía no tenés cuenta?</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/register')}>
            Registrate
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
    paddingTop: 98,
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
    paddingTop: 44,
    paddingHorizontal: 30,
  },
  loginButton: {
    marginTop: 18,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 8,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontFamily: ClayTheme.typography.fontFamily.bold,
    color: ClayTheme.colors.text,
  },
  footer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 46,
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
  }
});
