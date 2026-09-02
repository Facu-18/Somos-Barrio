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

const marketSchema = z.object({
  title: z.string().min(3, 'El título es muy corto').max(255),
  description: z.string().min(5, 'Escribe una mejor descripción').max(2000),
  price: z.string().optional(),
  category: z.enum(['ELECTRONICA', 'ROPA', 'MUEBLES', 'DEPORTES', 'SE_BUSCA', 'SE_REGALA', 'OTROS']),
});

type MarketForm = z.infer<typeof marketSchema>;

const categories = [
  { label: 'Electrónica', value: 'ELECTRONICA' },
  { label: 'Ropa', value: 'ROPA' },
  { label: 'Muebles', value: 'MUEBLES' },
  { label: 'Deportes', value: 'DEPORTES' },
  { label: 'Se Regala', value: 'SE_REGALA' },
  { label: 'Otros', value: 'OTROS' },
];

export default function CreateMarketScreen() {
  const { data: user } = useAuth();
  const barrioSlug = user?.barrio?.slug || 'palermo';
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<MarketForm>({
    resolver: zodResolver(marketSchema),
    defaultValues: { title: '', description: '', price: '', category: 'OTROS' }
  });

  const selectedCategory = watch('category');

  const pickImage = async () => {
    if (selectedImages.length >= 3) return; // Limit to 3 images

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages([...selectedImages, result.assets[0].uri]);
    }
  };

  const uploadImages = async (uris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of uris) {
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      urls.push(response.data.data.url);
    }
    return urls;
  };

  const createMutation = useMutation({
    mutationFn: async (data: MarketForm) => {
      let uploadedUrls: string[] = [];
      if (selectedImages.length > 0) {
        setIsUploading(true);
        uploadedUrls = await uploadImages(selectedImages);
        setIsUploading(false);
      }

      const parsedPrice = data.price ? parseInt(data.price, 10) : 0;

      const response = await api.post(`/barrios/${barrioSlug}/marketplace`, {
        title: data.title,
        description: data.description,
        price: parsedPrice,
        category: data.category,
        images: uploadedUrls,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market', barrioSlug] });
      router.back();
    },
    onError: (error: any) => {
      setIsUploading(false);
      setGlobalError(error.response?.data?.message || 'Error al publicar el producto.');
    }
  });

  const onSubmit = (data: MarketForm) => {
    setGlobalError('');
    createMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar Producto</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          {/* Image Picker */}
          <View style={styles.imagePickerContainer}>
            <Text style={styles.label}>Fotos (máx. 3)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {selectedImages.map((uri, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity 
                    style={styles.removeImageBtn}
                    onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== index))}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {selectedImages.length < 3 && (
                <TouchableOpacity onPress={pickImage} style={styles.addImageBtn}>
                  <MaterialCommunityIcons name="camera-plus" size={30} color={ClayTheme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <ClayInput
                label="Título del producto"
                placeholder="Ej: Bicicleta rodado 26"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.title?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, onBlur, value } }) => (
              <ClayInput
                label="Precio ($ ARS)"
                placeholder="Dejar vacío si es gratis"
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.price?.message}
              />
            )}
          />

          <View style={styles.categoryContainer}>
            <Text style={styles.label}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setValue('category', cat.value as any)}
                  style={[
                    styles.categoryPill, 
                    selectedCategory === cat.value && styles.categoryPillActive
                  ]}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === cat.value && styles.categoryTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <ClayInput
                label="Descripción"
                placeholder="Detalles sobre el estado, medidas, zona..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.description?.message}
                multiline
                numberOfLines={4}
                style={{ height: 100, paddingTop: 16 }}
              />
            )}
          />

          <ClayButton 
            title={createMutation.isPending || isUploading ? "Publicando..." : "Publicar"} 
            onPress={handleSubmit(onSubmit)} 
            disabled={createMutation.isPending || isUploading}
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
    gap: 10,
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
  },
  label: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.textInput,
    marginBottom: 8,
    paddingLeft: 4,
  },
  imagePickerContainer: {
    marginBottom: 16,
  },
  imageScroll: {
    flexDirection: 'row',
  },
  addImageBtn: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: ClayTheme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: ClayTheme.colors.surface,
    borderStyle: 'dashed',
  },
  imagePreview: {
    width: 90,
    height: 90,
    borderRadius: 16,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ClayTheme.colors.inputBg,
  },
  categoryPillActive: {
    backgroundColor: ClayTheme.colors.primary,
  },
  categoryText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 13,
    color: ClayTheme.colors.text,
  },
  categoryTextActive: {
    color: ClayTheme.colors.primaryText,
  }
});
