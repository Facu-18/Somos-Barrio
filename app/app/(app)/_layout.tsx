import { Stack } from 'expo-router';

export default function AppLayout() {
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
