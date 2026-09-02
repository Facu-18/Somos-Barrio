import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'somos_barrio_refresh_token';

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
  }
};
