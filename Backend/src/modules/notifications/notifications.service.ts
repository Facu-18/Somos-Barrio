import { GoogleAuth } from 'google-auth-library';
import { prisma } from '../../lib/prisma';
import fs from 'fs';
import path from 'path';

// Define expected path for the service account key
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../../../../firebase-service-account.json');
let auth: GoogleAuth | null = null;
let projectId: string | null = null;

try {
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    projectId = serviceAccount.project_id;
    
    auth = new GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });
    console.log(`[FCM] Firebase Push Notifications configured for project ${projectId}`);
  } else {
    console.warn(`[FCM] Warning: ${SERVICE_ACCOUNT_PATH} not found. Push notifications will be disabled.`);
  }
} catch (error) {
  console.error('[FCM] Error initializing Google Auth:', error);
}

export const notificationsService = {
  async registerDevice(userId: string, token: string, platform: string) {
    // Upsert the token
    return prisma.pushDevice.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform }
    });
  },

  async unregisterDevice(token: string) {
    try {
      await prisma.pushDevice.delete({ where: { token } });
    } catch (e) {
      // Ignore if not found
    }
  },

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    if (!auth || !projectId) {
      console.log(`[FCM] Push skipped for user ${userId}: Firebase not configured.`);
      return;
    }

    const devices = await prisma.pushDevice.findMany({ where: { userId } });
    if (devices.length === 0) return;

    try {
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      const promises = devices.map(async (device) => {
        const payload = {
          message: {
            token: device.token,
            notification: { title, body },
            data: data || {},
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                color: '#4A3B8C',
                channel_id: 'default'
              }
            }
          }
        };

        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken.token}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorData: any = await res.json();
          // HTTP 404 or UNREGISTERED means the token is no longer valid
          if (res.status === 404 || (errorData.error && errorData.error.details?.some((d: any) => d.errorCode === 'UNREGISTERED'))) {
            console.log(`[FCM] Token expired for user ${userId}, removing token.`);
            await this.unregisterDevice(device.token);
          } else {
            console.error('[FCM] Send error:', errorData);
          }
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('[FCM] Error sending push notification:', error);
    }
  }
};
