import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold 
} from '@expo-google-fonts/nunito';
import { authSession } from '../lib/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function SessionInvalidationObserver() {
  useEffect(() => {
    const clearSession = () => {
      queryClient.cancelQueries();
      queryClient.removeQueries({ queryKey: ['auth'], exact: false });
      queryClient.setQueryData(['auth', 'me'], null);
    };
    const unsubscribeEnding = authSession.subscribeEnding(clearSession);
    const unsubscribeInvalidation = authSession.subscribe(clearSession);
    return () => {
      unsubscribeEnding();
      unsubscribeInvalidation();
    };
  }, []);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);


  if (!loaded && !error) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionInvalidationObserver />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </QueryClientProvider>
  );
}
