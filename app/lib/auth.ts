import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'somos_barrio_refresh_token';
const PUSH_TOKEN_KEY = 'somos_barrio_expo_push_token';
const PENDING_PUSH_TOKEN_KEY = 'somos_barrio_pending_push_token';
let pendingPushMutation: Promise<void> = Promise.resolve();

async function readPendingPushTokens() {
  const value = await SecureStore.getItemAsync(PENDING_PUSH_TOKEN_KEY);
  if (!value) return [];
  try {
    const tokens: unknown = JSON.parse(value);
    return Array.isArray(tokens) ? tokens.filter((token): token is string => typeof token === 'string') : [];
  } catch {
    return [];
  }
}

async function getPendingPushTokens() {
  await pendingPushMutation;
  return readPendingPushTokens();
}

function updatePendingPushTokens(update: (tokens: string[]) => string[]) {
  const operation = pendingPushMutation.then(async () => {
    const tokens = update(await readPendingPushTokens());
    if (tokens.length > 0) {
      await SecureStore.setItemAsync(PENDING_PUSH_TOKEN_KEY, JSON.stringify(tokens));
    } else {
      await SecureStore.deleteItemAsync(PENDING_PUSH_TOKEN_KEY);
    }
  });
  pendingPushMutation = operation.catch(() => undefined);
  return operation;
}

type SessionListener = () => void;
let sessionVersion = 0;
const sessionListeners = new Set<SessionListener>();
const sessionEndingListeners = new Set<SessionListener>();

export const authSession = {
  getSnapshot: () => sessionVersion,
  subscribe(listener: SessionListener) {
    sessionListeners.add(listener);
    return () => {
      sessionListeners.delete(listener);
    };
  },
  subscribeEnding(listener: SessionListener) {
    sessionEndingListeners.add(listener);
    return () => {
      sessionEndingListeners.delete(listener);
    };
  },
  beginEnding() {
    sessionEndingListeners.forEach((listener) => listener());
  },
  invalidate() {
    sessionVersion += 1;
    sessionListeners.forEach((listener) => listener());
  },
};

export const authStorage = {
  async saveRefreshToken(token: string) {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving refresh token', error);
    }
  },
  
  async getRefreshToken() {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting refresh token', error);
      return null;
    }
  },
  
  async deleteRefreshToken() {
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error deleting refresh token', error);
    }
  },

  async savePushToken(token: string) {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  },

  async getPushToken() {
    return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  },

  async deletePushToken() {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  },

  async addPendingPushToken(token: string) {
    await updatePendingPushTokens((tokens) => tokens.includes(token) ? tokens : [...tokens, token]);
  },

  getPendingPushTokens,

  async removePendingPushToken(token: string) {
    await updatePendingPushTokens((tokens) => tokens.filter((candidate) => candidate !== token));
  },
};
