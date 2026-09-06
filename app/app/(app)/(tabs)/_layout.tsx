import { Tabs } from 'expo-router';
import { ClayTheme } from '../../../constants/ClayTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Calculate dynamic bottom padding based on device insets
  const bottomPadding = Math.max(20, insets.bottom + 10);
  const barHeight = 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: ClayTheme.colors.background,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: ClayTheme.colors.text,
        headerTitleStyle: {
          fontFamily: ClayTheme.typography.fontFamily.extraBold,
          fontSize: 20,
        },
        tabBarStyle: {
          backgroundColor: ClayTheme.colors.surface,
          borderTopWidth: 0,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 10,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          ...ClayTheme.shadows.elevated,
        },
        tabBarActiveTintColor: ClayTheme.colors.primary,
        tabBarInactiveTintColor: ClayTheme.colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: ClayTheme.typography.fontFamily.bold,
          fontSize: 11,
          marginTop: 2,
        },
        sceneStyle: {
          backgroundColor: ClayTheme.colors.background,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActiveBg : null}>
              <MaterialCommunityIcons name="home" size={24} color={focused ? ClayTheme.colors.primaryText : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Mercado',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActiveBg : null}>
              <MaterialCommunityIcons name="storefront" size={24} color={focused ? ClayTheme.colors.primaryText : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="businesses"
        options={{
          title: 'Comercios',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActiveBg : null}>
              <MaterialCommunityIcons name="store" size={24} color={focused ? ClayTheme.colors.primaryText : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: 'Foro',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActiveBg : null}>
              <MaterialCommunityIcons name="forum" size={24} color={focused ? ClayTheme.colors.primaryText : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Eventos',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActiveBg : null}>
              <MaterialCommunityIcons name="calendar" size={24} color={focused ? ClayTheme.colors.primaryText : color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconActiveBg: {
    backgroundColor: ClayTheme.colors.primary,
    width: 46,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
