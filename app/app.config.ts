import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

let generatedGoogleServicesFile: string | undefined;

function resolveGoogleServicesFile() {
  const values = {
    FIREBASE_PROJECT_NUMBER: process.env.FIREBASE_PROJECT_NUMBER?.trim(),
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID?.trim(),
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET?.trim(),
    FIREBASE_ANDROID_APP_ID: process.env.FIREBASE_ANDROID_APP_ID?.trim(),
    FIREBASE_ANDROID_PACKAGE_NAME: process.env.FIREBASE_ANDROID_PACKAGE_NAME?.trim(),
    FIREBASE_ANDROID_API_KEY: process.env.FIREBASE_ANDROID_API_KEY?.trim(),
  };
  if (!Object.values(values).some(Boolean)) return undefined;

  const missing = Object.entries(values).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) throw new Error(`Missing Firebase variables: ${missing.join(', ')}`);
  if (values.FIREBASE_ANDROID_PACKAGE_NAME !== 'com.somosbarrio.app') {
    throw new Error('FIREBASE_ANDROID_PACKAGE_NAME must be com.somosbarrio.app.');
  }
  if (generatedGoogleServicesFile) return generatedGoogleServicesFile;

  const firebaseConfig = {
    project_info: {
      project_number: values.FIREBASE_PROJECT_NUMBER,
      project_id: values.FIREBASE_PROJECT_ID,
      storage_bucket: values.FIREBASE_STORAGE_BUCKET,
    },
    client: [{
      client_info: {
        mobilesdk_app_id: values.FIREBASE_ANDROID_APP_ID,
        android_client_info: { package_name: values.FIREBASE_ANDROID_PACKAGE_NAME },
      },
      oauth_client: [],
      api_key: [{ current_key: values.FIREBASE_ANDROID_API_KEY }],
      services: { appinvite_service: { other_platform_oauth_client: [] } },
    }],
    configuration_version: '1',
  };
  const generatedDirectory = join(process.cwd(), '.expo');
  mkdirSync(generatedDirectory, { recursive: true });
  generatedGoogleServicesFile = join(generatedDirectory, 'google-services.json');
  writeFileSync(generatedGoogleServicesFile, JSON.stringify(firebaseConfig), { encoding: 'utf8', mode: 0o600 });
  return generatedGoogleServicesFile;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (apiUrl && !/^https?:\/\/[^\s]+$/i.test(apiUrl)) {
    throw new Error('EXPO_PUBLIC_API_URL must be an absolute http(s) URL.');
  }
  if ((buildProfile === 'preview' || buildProfile === 'production') && !apiUrl) {
    throw new Error(`EXPO_PUBLIC_API_URL is required for the ${buildProfile} build profile.`);
  }

  const googleServicesFile = resolveGoogleServicesFile();

  return {
    ...config,
    owner: 'facundo19',
    name: 'Somos Barrio',
    slug: 'somos-barrio',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'somosbarrio',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: { supportsTablet: true, bundleIdentifier: 'com.somosbarrio.app' },
    android: {
      package: 'com.somosbarrio.app',
      ...(googleServicesFile ? { googleServicesFile } : {}),
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      ['expo-splash-screen', {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { backgroundColor: '#000000' },
      }],
      'expo-secure-store',
      ['expo-notifications', {
        icon: './assets/images/android-icon-monochrome.png',
        color: '#4A3B8C',
        defaultChannel: 'default',
      }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      router: {},
      eas: { projectId: 'f97784d5-6d05-4d5b-a369-dec16c5759e5' },
    },
  };
};
