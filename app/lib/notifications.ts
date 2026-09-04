import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';
import { api } from './api';
import { authSession, authStorage } from './auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getProjectId = () => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
    || Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('No se encontró el projectId de EAS para notificaciones.');
  }
  return projectId;
};

const hasPermission = (permissions: Notifications.NotificationPermissionsStatus) =>
  permissions.granted
  || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

let registrationAttempt: { userId: string; promise: Promise<string | null> } | null = null;
let registeredSession: { userId: string; token: string } | null = null;
let cleanupAttempt: Promise<void> | null = null;
let lastNativeToken: string | null = null;
let nativeTokenVersion = 0;
let activeUserId: string | null = null;

authSession.subscribeEnding(() => {
  activeUserId = null;
  registeredSession = null;
  cleanupAttempt = null;
});

async function saveDeviceToken(token: string) {
  const previousToken = await authStorage.getPushToken();
  await api.post('/notifications/register', { token, platform: Platform.OS });
  await authStorage.savePushToken(token);
  await authStorage.removePendingPushToken(token);

  if (previousToken && previousToken !== token) {
    await api.delete('/notifications/register', { data: { token: previousToken } }).catch(async () => {
      await authStorage.addPendingPushToken(previousToken);
    });
  }
}

async function cleanupPendingPushDevice() {
  const tokens = await authStorage.getPendingPushTokens();
  let firstError: unknown;
  for (const token of tokens) {
    try {
      await api.post('/notifications/unregister', { token });
      await authStorage.removePendingPushToken(token);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

async function performPushRegistration(userId: string) {
  if (activeUserId !== userId || Platform.OS === 'web' || !Device.isDevice) return null;

  cleanupAttempt ??= cleanupPendingPushDevice().catch((error) => {
    console.warn('No se pudo limpiar un registro push anterior.', error);
  });
  await cleanupAttempt;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones del barrio',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A3B8C',
    });
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (!hasPermission(permissions)) permissions = await Notifications.requestPermissionsAsync();
  if (!hasPermission(permissions) || activeUserId !== userId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() })).data;
  if (activeUserId !== userId) return null;
  if (registeredSession?.userId === userId && registeredSession.token === token) return token;
  await saveDeviceToken(token);
  if (activeUserId !== userId) {
    try {
      await api.post('/notifications/unregister', { token });
    } catch {
      await authStorage.addPendingPushToken(token).catch(() => undefined);
    } finally {
      if (await authStorage.getPushToken() === token) await authStorage.deletePushToken();
    }
    return null;
  }
  registeredSession = { userId, token };
  return token;
}

export function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (registrationAttempt?.userId === userId) return registrationAttempt.promise;
  if (registrationAttempt) {
    return registrationAttempt.promise.then(
      () => registerForPushNotificationsAsync(userId),
      () => registerForPushNotificationsAsync(userId),
    );
  }

  const registrationNativeTokenVersion = nativeTokenVersion;
  const promise = performPushRegistration(userId).finally(() => {
    if (registrationAttempt?.promise === promise) registrationAttempt = null;
    if (activeUserId === userId && nativeTokenVersion !== registrationNativeTokenVersion) {
      void registerForPushNotificationsAsync(userId).catch((error) => {
        console.warn('No se pudo actualizar el token push rotado.', error);
      });
    }
  });
  registrationAttempt = { userId, promise };
  return promise;
}

export function activatePushRegistration(userId: string) {
  activeUserId = userId;
  if (registeredSession?.userId !== userId) registeredSession = null;
}

export function deactivatePushRegistration(userId: string) {
  if (activeUserId !== userId) return;
  activeUserId = null;
  registeredSession = null;
  cleanupAttempt = null;
}

export function addPushTokenRotationListener(userId: string) {
  if (Platform.OS === 'web') return null;
  return Notifications.addPushTokenListener((token) => {
    const nativeToken = `${token.type}:${typeof token.data === 'string' ? token.data : JSON.stringify(token.data)}`;
    if (nativeToken === lastNativeToken) return;
    lastNativeToken = nativeToken;
    nativeTokenVersion += 1;
    registeredSession = null;
    if (!registrationAttempt) {
      registerForPushNotificationsAsync(userId).catch((error) => {
        console.warn('No se pudo actualizar el token push rotado.', error);
      });
    }
  });
}

export async function unregisterPushDeviceAsync() {
  const token = await authStorage.getPushToken();
  if (!token) return;
  await api.delete('/notifications/register', { data: { token } });
  await authStorage.deletePushToken();
}

type NotificationData = Record<string, unknown>;

const stringValue = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : null;

export function getNotificationRoute(data: NotificationData): Href | null {
  const type = stringValue(data.type);
  if (type === 'forum_reply' || type === 'forum-reply') {
    const id = stringValue(data.threadId);
    const subforumSlug = stringValue(data.subforumSlug);
    if (!id || !subforumSlug) return null;
    const replyId = stringValue(data.replyId);
    return {
      pathname: '/(app)/thread/[id]',
      params: { id, subforumSlug, ...(replyId ? { replyId } : {}) },
    };
  }
  if (type === 'event') {
    const id = stringValue(data.eventId);
    return id ? { pathname: '/(app)/event/[id]', params: { id } } : null;
  }
  if (type === 'market') {
    const id = stringValue(data.marketId);
    return id ? { pathname: '/(app)/market/[id]', params: { id } } : null;
  }
  if (type === 'business') {
    const slug = stringValue(data.businessSlug);
    return slug ? { pathname: '/(app)/business/[slug]', params: { slug } } : null;
  }
  if (type === 'news') {
    const slug = stringValue(data.newsSlug);
    return slug ? { pathname: '/(app)/news/[slug]', params: { slug } } : null;
  }
  return null;
}
