import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { ClayTheme } from '../../constants/ClayTheme';
import { useAuth } from '../../hooks/useAuth';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../../lib/notifications';

export default function AppLayout() {
  const { data: user, isLoading, error } = useAuth();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();

      const subscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notificación recibida en foreground:', notification);
      });

      return () => subscription.remove();
    }
  }, [user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: ClayTheme.colors.background }}>
        <ActivityIndicator size="large" color={ClayTheme.colors.primary} />
      </View>
    );
  }

  // Si no hay usuario activo o falló la recuperación de sesión, volver a login
  if (!user || error) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!user.barrio?.slug) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: ClayTheme.colors.background, padding: 40 }}>
        <Text style={{ fontFamily: ClayTheme.typography.fontFamily.extraBold, fontSize: 22, color: ClayTheme.colors.text, textAlign: 'center', marginBottom: 10 }}>Falta tu barrio</Text>
        <Text style={{ fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 16, color: ClayTheme.colors.textMuted, textAlign: 'center' }}>Tu cuenta no tiene un barrio asignado. Por favor, contacta a soporte.</Text>
      </View>
    );
  }

  return (
    <Stack>
      {/* Las pestañas principales no tienen cabecera porque cada vista maneja su propio título */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* Pantallas modales (se abren deslizando desde abajo) */}
      <Stack.Screen 
        name="create-thread" 
        options={{ 
          presentation: 'modal', 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="create-market" 
        options={{ 
          presentation: 'modal', 
          headerShown: false 
        }} 
      />
    </Stack>
  );
}
