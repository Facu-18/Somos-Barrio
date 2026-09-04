import { Stack, Redirect, router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { ClayTheme } from '../../constants/ClayTheme';
import { useAuth } from '../../hooks/useAuth';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import {
  activatePushRegistration,
  addPushTokenRotationListener,
  deactivatePushRegistration,
  getNotificationRoute,
  registerForPushNotificationsAsync,
} from '../../lib/notifications';
import { useQueryClient } from '@tanstack/react-query';

export default function AppLayout() {
  const { data: user, isLoading, error } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (userId) {
      activatePushRegistration(userId);
      registerForPushNotificationsAsync(userId).catch((registrationError) => {
        console.warn('No se pudieron registrar las notificaciones push.', registrationError);
      });

      const navigateFromNotification = (notification: Notifications.Notification) => {
        const route = getNotificationRoute(notification.request.content.data);
        if (route) router.push(route);
      };

      const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        if ((data.type === 'forum_reply' || data.type === 'forum-reply') && typeof data.threadId === 'string') {
          queryClient.invalidateQueries({ queryKey: ['thread-detail'], exact: false });
        }
      });
      const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          navigateFromNotification(response.notification);
        }
      });
      const tokenSubscription = addPushTokenRotationListener(userId);

      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          navigateFromNotification(response.notification);
          Notifications.clearLastNotificationResponseAsync();
        }
      }).catch((notificationError) => {
        console.warn('No se pudo procesar la notificación inicial.', notificationError);
      });

      return () => {
        deactivatePushRegistration(userId);
        receivedSubscription.remove();
        responseSubscription.remove();
        tokenSubscription?.remove();
      };
    }
  }, [queryClient, userId]);

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
    <Stack screenOptions={{ headerShown: false }}>
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
