import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { useAuth } from '../../hooks/useAuth';
import { logoutMobileSession } from '../../lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    Alert.alert(
      "Cerrar sesión",
      "¿Estás seguro que querés salir de tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, salir", 
          style: "destructive",
          onPress: async () => {
            const remoteLogout = logoutMobileSession();
            queryClient.clear();
            queryClient.setQueryData(['auth', 'me'], null);
            router.replace('/(auth)/login');
            try {
              await remoteLogout;
            } catch {
              console.warn('No se pudo cerrar la sesión remota; se cerrará localmente.');
            }
          }
        }
      ]
    );
  };

  const getInitials = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || 'XX';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Volver">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user?.name || '')}</Text>
            )}
          </View>
          <Text style={styles.userName}>{user?.nickname || user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.bio && <Text style={styles.userBio}>{user.bio}</Text>}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.barrio?.name || 'Cargando...'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <ClayButton 
            title="Editar perfil" 
            onPress={() => router.push('/(app)/edit-profile')} 
            style={styles.editButton}
          />
          <ClayButton 
            title="Cerrar sesión" 
            onPress={handleLogout} 
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClayTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 20,
    backgroundColor: ClayTheme.colors.surface,
    ...ClayTheme.shadows.elevated,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 18,
    color: ClayTheme.colors.text,
  },
  content: {
    padding: 22,
    alignItems: 'center',
  },
  profileCard: {
    width: '100%',
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    ...ClayTheme.shadows.elevated,
    marginBottom: 30,
    marginTop: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: ClayTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...ClayTheme.shadows.elevated,
  },
  avatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 32,
    color: ClayTheme.colors.primaryText,
  },
  userName: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 24,
    color: ClayTheme.colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 15,
    color: ClayTheme.colors.textMuted,
    marginBottom: 16,
  },
  userBio: {
    fontFamily: ClayTheme.typography.fontFamily.medium,
    fontSize: 14,
    color: ClayTheme.colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  roleBadge: {
    backgroundColor: '#E1EFE2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  roleText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: '#35663A',
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  editButton: {
    backgroundColor: ClayTheme.colors.primary,
  },
  logoutButton: {
    backgroundColor: ClayTheme.colors.error,
  }
});
