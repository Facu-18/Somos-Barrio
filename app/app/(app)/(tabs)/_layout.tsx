import { Tabs } from 'expo-router';
import { ClayTheme } from '../../../constants/ClayTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet, Text } from 'react-native';
import { TAB_BAR_HEIGHT, useTabBarSpace } from '../../../hooks/useTabBarSpace';

export default function TabsLayout() {
  const { barBottom } = useTabBarSpace();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: barBottom,
          height: TAB_BAR_HEIGHT,
          backgroundColor: ClayTheme.colors.surface,
          borderRadius: 28,
          // React Navigation agrega una línea superior que se nota sobre la barra redondeada.
          borderTopWidth: 0,
          paddingHorizontal: 4,
          paddingTop: 0,
          paddingBottom: 0,
          ...ClayTheme.shadows.elevated,
        },
        // El ítem por defecto trae padding y un alto de ícono fijo que descentran el ícono con etiqueta.
        tabBarItemStyle: {
          height: TAB_BAR_HEIGHT,
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          width: '100%',
          height: '100%',
        },
        tabBarShowLabel: false, // We'll render custom labels in tabBarIcon for precise control
        sceneStyle: {
          backgroundColor: ClayTheme.colors.background,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <View style={focused ? styles.iconActiveBg : styles.iconInactiveBg}>
                <MaterialCommunityIcons 
                  name="home-outline" 
                  size={21} 
                  color={focused ? ClayTheme.colors.primaryText : ClayTheme.colors.textFaint} 
                />
              </View>
              <Text style={focused ? styles.labelActive : styles.labelInactive} numberOfLines={1} maxFontSizeMultiplier={1.1}>Inicio</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Mercado',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <View style={focused ? styles.iconActiveBg : styles.iconInactiveBg}>
                <MaterialCommunityIcons 
                  name="storefront-outline" 
                  size={21} 
                  color={focused ? ClayTheme.colors.primaryText : ClayTheme.colors.textFaint} 
                />
              </View>
              <Text style={focused ? styles.labelActive : styles.labelInactive} numberOfLines={1} maxFontSizeMultiplier={1.1}>Mercado</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="businesses"
        options={{
          title: 'Comercios',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <View style={focused ? styles.iconActiveBg : styles.iconInactiveBg}>
                <MaterialCommunityIcons 
                  name="store-outline" 
                  size={21} 
                  color={focused ? ClayTheme.colors.primaryText : ClayTheme.colors.textFaint} 
                />
              </View>
              <Text style={focused ? styles.labelActive : styles.labelInactive} numberOfLines={1} maxFontSizeMultiplier={1.1}>Comercios</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          title: 'Foro',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <View style={focused ? styles.iconActiveBg : styles.iconInactiveBg}>
                <MaterialCommunityIcons 
                  name="forum-outline" 
                  size={21} 
                  color={focused ? ClayTheme.colors.primaryText : ClayTheme.colors.textFaint} 
                />
              </View>
              <Text style={focused ? styles.labelActive : styles.labelInactive} numberOfLines={1} maxFontSizeMultiplier={1.1}>Foro</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Eventos',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <View style={focused ? styles.iconActiveBg : styles.iconInactiveBg}>
                <MaterialCommunityIcons 
                  name="calendar-blank-outline" 
                  size={21} 
                  color={focused ? ClayTheme.colors.primaryText : ClayTheme.colors.textFaint} 
                />
              </View>
              <Text style={focused ? styles.labelActive : styles.labelInactive} numberOfLines={1} maxFontSizeMultiplier={1.1}>Eventos</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Sin ancho fijo: react-navigation ya reparte el ancho entre las 5 pestañas.
  // Fijarlo en 70 sumaba 358 px y desbordaba en pantallas de 360.
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: TAB_BAR_HEIGHT,
    width: '100%',
    paddingHorizontal: 2,
  },
  // Pill, no un rectangulo de radio 13: es el lenguaje del sistema para
  // "chip activo", y es el mismo radio que los chips de categoria.
  iconActiveBg: {
    backgroundColor: ClayTheme.colors.primary,
    width: 46,
    height: 32,
    borderRadius: ClayTheme.borders.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInactiveBg: {
    width: 46,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelActive: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 11,
    color: ClayTheme.colors.primaryDark,
  },
  labelInactive: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 11,
    color: ClayTheme.colors.textFaint,
  },
});
