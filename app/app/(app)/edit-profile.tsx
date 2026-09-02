import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ClayInput } from '../../components/ClayInput';
import { api } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const profileSchema = z.object({
  nickname: z.string().min(2, "El apodo es muy corto").max(30, "El apodo es muy largo").optional().or(z.literal("")),
  bio: z.string().max(160, "La biografía es muy larga").optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function EditProfileScreen() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(user?.avatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { 
      nickname: user?.nickname || '', 
      bio: user?.bio || '' 
    }
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    // If it's already an http url, it means it wasn't changed (it's the current avatarUrl)
    if (uri.startsWith('http')) return uri;

    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;
    
    const formData = new FormData();
    formData.append('file', { uri, name: filename, type } as any);
    
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.url;
  };

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      let avatarUrl = user?.avatarUrl || '';
      
      if (selectedImage && selectedImage !== user?.avatarUrl) {
        setIsUploading(true);
        avatarUrl = await uploadImage(selectedImage);
        setIsUploading(false);
      } else if (!selectedImage) {
        avatarUrl = ''; // User removed image
      }

      // Evitamos mandar vacío si no hay cambios
      const payload: any = {};
      payload.nickname = data.nickname;
      payload.bio = data.bio;
      payload.avatarUrl = avatarUrl;
      payload.avatarPublicId = ""; // Para implementaciones futuras si usamos Cloudinary ids directos

      const response = await api.patch(`/auth/me`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.back();
    },
    onError: (error: any) => {
      setIsUploading(false);
      setGlobalError(error.response?.data?.message || 'Error al actualizar el perfil.');
    }
  });

  const onSubmit = (data: ProfileForm) => {
    setGlobalError('');
    updateMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || 'XX';
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{getInitials(user?.name || '')}</Text>
                </View>
              )}
            </View>
            <View style={styles.avatarActions}>
              <ClayButton title="Cambiar foto" onPress={pickImage} style={styles.changePicBtn} />
              {selectedImage && (
                <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removePicBtn}>
                  <Text style={styles.removePicText}>Quitar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Controller
            control={control}
            name="nickname"
            render={({ field: { onChange, onBlur, value } }) => (
              <ClayInput
                label="Apodo (Nickname)"
                placeholder="Ej: Facu"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.nickname?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="bio"
            render={({ field: { onChange, onBlur, value } }) => (
              <ClayInput
                label="Biografía breve"
                placeholder="Vecino del barrio desde 2010..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.bio?.message}
                multiline
                numberOfLines={3}
                style={{ height: 80, paddingTop: 16 }}
              />
            )}
          />

          <ClayButton 
            title={updateMutation.isPending || isUploading ? "Guardando..." : "Guardar cambios"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={updateMutation.isPending || isUploading}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
  },
  form: {
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ClayTheme.colors.inputBg,
    marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    ...ClayTheme.shadows.elevated,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: ClayTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 40,
    color: ClayTheme.colors.primaryText,
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  changePicBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  removePicBtn: {
    padding: 10,
  },
  removePicText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    color: ClayTheme.colors.error,
  },
  submitButton: {
    marginTop: 20,
  },
  globalError: {
    color: ClayTheme.colors.error,
    fontSize: 14,
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    textAlign: 'center',
    marginBottom: 16,
  }
});
