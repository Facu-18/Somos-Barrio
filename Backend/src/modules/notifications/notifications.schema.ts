import { z } from "zod";

const expoPushToken = z.string().regex(
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/,
  "Token de Expo Push invalido"
);

export const deviceSchema = z.object({
  token: expoPushToken,
  platform: z.enum(["android", "ios"])
});

export const unregisterDeviceSchema = z.object({ token: expoPushToken });
