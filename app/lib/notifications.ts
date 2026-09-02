import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A3B8C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Fallo al obtener permiso para notificaciones push');
      return;
    }

    try {
      // Usamos getDevicePushTokenAsync porque interactuamos directamente con FCM V1 (bypassing exp.host)
      token = (await Notifications.getDevicePushTokenAsync()).data;
      console.log('Device Push Token (FCM):', token);

      // Enviarlo a nuestro backend
      await api.post('/notifications/register', {
        token,
        platform: Platform.OS
      });

    } catch (e) {
      console.error('Error obteniendo token push:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
