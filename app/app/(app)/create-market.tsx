import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { ClayTheme } from '../../constants/ClayTheme';
import { ClayButton } from '../../components/ClayButton';
import { ClayInput } from '../../components/ClayInput';
import { api } from '../../lib/api';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MarketplaceAssetStatus, MarketplaceAssetUpload, MarketplacePost } from '../../types/api';
import { useFormBottomPadding } from '../../hooks/useTabBarSpace';

const marketSchema = z.object({
  title: z.string().min(3, 'El título es muy corto').max(255),
  description: z.string().min(5, 'Escribe una mejor descripción').max(2000),
  price: z.string().optional(),
  whatsapp: z.string().min(1, 'WhatsApp es obligatorio').refine((value) => {
    const digits = value.replace(/\D/g, '').replace(/^00/, '');
    return /^[1-9]\d{7,14}$/.test(digits);
  }, 'Ingresá el código de país y el número (ej. +54 9 11...)'),
  category: z.enum(['ELECTRONICA', 'ROPA', 'MUEBLES', 'DEPORTES', 'SE_BUSCA', 'SE_REGALA', 'OTROS']),
});

type MarketForm = z.infer<typeof marketSchema>;
const normalizeWhatsApp = (value: string) => `+${value.replace(/\D/g, '').replace(/^00/, '')}`;

const categories = [
  { label: 'Electrónica', value: 'ELECTRONICA' },
  { label: 'Ropa', value: 'ROPA' },
  { label: 'Muebles', value: 'MUEBLES' },
  { label: 'Deportes', value: 'DEPORTES' },
  { label: 'Se Regala', value: 'SE_REGALA' },
  { label: 'Otros', value: 'OTROS' },
];

type SelectedImage = {
  uri: string;
  assetId?: string;
  status?: MarketplaceAssetStatus;
  name?: string;
  mimeType?: string;
  file?: File;
};

export default function CreateMarketScreen() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const insets = useSafeAreaInsets();
  const formBottomPadding = useFormBottomPadding();

  const { data: postToEdit, isLoading: isLoadingPost, refetch: refetchPost } = useQuery<MarketplacePost>({
    queryKey: ['market', barrioSlug, postId],
    queryFn: async () => {
      const response = await api.get(`/barrios/${barrioSlug}/marketplace/${postId}`);
      return response.data.data;
    },
    enabled: !!postId,
  });

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<MarketForm>({
    resolver: zodResolver(marketSchema),
    defaultValues: { title: '', description: '', price: '', whatsapp: '', category: 'OTROS' }
  });

  React.useEffect(() => {
    if (postToEdit) {
      reset({
        title: postToEdit.title,
        description: postToEdit.description,
        price: postToEdit.price ? postToEdit.price.toString() : '',
        whatsapp: postToEdit.whatsapp || '',
        category: postToEdit.category,
      });
      setSelectedImages((postToEdit.managedAssets || []).map((asset) => ({
        uri: asset.url || '',
        assetId: asset.id,
        status: asset.status
      })));
    }
  }, [postToEdit, reset]);

  const selectedCategory = watch('category');

  const pickImage = async () => {
    if (selectedImages.length >= 3) return; // Limit to 3 images

    Alert.alert(
      "Seleccionar Foto",
      "¿Desde dónde quieres agregar la foto?",
      [
        {
          text: "Cámara",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para tomar fotos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });
            if (!result.canceled) {
              const asset = result.assets[0];
              setSelectedImages((prev) => [...prev, { uri: asset.uri, name: asset.fileName ?? undefined, mimeType: asset.mimeType, file: asset.file }]);
            }
          }
        },
        {
          text: "Galería",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });
            if (!result.canceled) {
              const asset = result.assets[0];
              setSelectedImages((prev) => [...prev, { uri: asset.uri, name: asset.fileName ?? undefined, mimeType: asset.mimeType, file: asset.file }]);
            }
          }
        },
        {
          text: "Cancelar",
          style: "cancel"
        }
      ]
    );
  };

  const uploadImages = async (images: SelectedImage[]): Promise<string[]> => {
    const assetIds: string[] = [];
    for (const image of images) {
      const filename = image.name || image.uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const extensionMime = match?.[1].toLowerCase() === 'jpg' ? 'image/jpeg' : match ? `image/${match[1].toLowerCase()}` : undefined;
      const type = image.mimeType || extensionMime || 'image/jpeg';
      
      const formData = new FormData();
      formData.append('file', image.file ?? ({ uri: image.uri, name: filename, type } as any));
      
      let response;
      try {
        response = await api.post<{ data: MarketplaceAssetUpload }>('/upload/marketplace', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (error: any) {
        const details = error.response?.data?.details;
        if (details?.assetId && details.status === 'REJECTED') {
          setSelectedImages((current) => current.map((candidate) =>
            candidate === image ? { ...candidate, assetId: details.assetId, status: details.status } : candidate
          ));
        }
        throw error;
      }
      const uploadedAsset = response.data.data;
      setSelectedImages((current) => current.map((candidate) =>
        candidate === image ? { ...candidate, assetId: uploadedAsset.id, status: uploadedAsset.status } : candidate
      ));
      const assetId = uploadedAsset.id;
      assetIds.push(assetId);
    }
    return assetIds;
  };

  const createMutation = useMutation({
    mutationFn: async (data: MarketForm) => {
      if (selectedImages.some((image) => image.status === 'REJECTED')) {
        throw new Error('Hay una imagen rechazada. Quitala para continuar.');
      }
      const existingAssetIds = selectedImages.flatMap((image) =>
        image.assetId && ['APPROVED', 'QUARANTINED'].includes(image.status || '') ? [image.assetId] : []
      );
      const localImages = selectedImages.filter((image) => !image.assetId);
      let uploadedAssetIds: string[] = [];
      if (localImages.length > 0) {
        setIsUploading(true);
        uploadedAssetIds = await uploadImages(localImages);
        setIsUploading(false);
      }

      const parsedPrice = data.price ? parseInt(data.price, 10) : 0;

      const payload = {
        title: data.title,
        description: data.description,
        price: parsedPrice,
        category: data.category,
        whatsapp: normalizeWhatsApp(data.whatsapp),
        assetIds: [...existingAssetIds, ...uploadedAssetIds],
        ...(postId && postToEdit ? { expectedVersion: postToEdit.moderationVersion } : {})
      };

      const response = postId
        ? await api.patch(`/barrios/${barrioSlug}/marketplace/${postId}`, payload)
        : await api.post(`/barrios/${barrioSlug}/marketplace`, payload);
      
      return response.data.data;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['market', barrioSlug] });
      queryClient.invalidateQueries({ queryKey: ['market', barrioSlug, 'me'] });
      if (postId) {
        queryClient.invalidateQueries({ queryKey: ['market', barrioSlug, postId] });
      }
      const message = post.moderationStatus === 'APPROVED'
        ? 'La publicación ya está visible en el marketplace.'
        : post.moderationStatus === 'REJECTED'
          ? 'La publicación no puede mostrarse por una categoría de contenido no permitida. Podés editarla y reenviarla.'
          : 'La publicación quedó en revisión y solo vos podés verla por ahora.';
      Alert.alert('Estado de la publicación', message, [{ text: 'Entendido', onPress: () => router.back() }]);
    },
    onError: (error: any) => {
      setIsUploading(false);
      const status = error.response?.status;
      if (status === 409 && postId) void refetchPost();
      const fallback = status === 422
        ? 'Una imagen fue rechazada por la política de contenido.'
        : status === 409
          ? 'La publicación fue modificada o está en apelación por lo que no se pudo actualizar. Volvé a intentarlo.'
          : [502, 503, 504].includes(status)
            ? 'El verificador de imágenes no está disponible. Intentá nuevamente más tarde.'
            : error.message || 'Error al publicar el producto.';
      setGlobalError(error.response?.data?.message || fallback);
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{postId ? 'Editar Producto' : 'Publicar Producto'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: formBottomPadding }]} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

          {/* Image Picker */}
          <View style={styles.imagePickerContainer}>
            <Text style={styles.label}>Fotos (máx. 3)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {selectedImages.map((image, index) => (
                <View key={image.assetId ?? image.uri} style={styles.imagePreview}>
                  {image.uri ? (
                    <Image source={{ uri: image.uri }} style={styles.image} />
                  ) : (
                    <View style={[styles.image, { alignItems: 'center', justifyContent: 'center' }]}>
                      <MaterialCommunityIcons name="shield-search" size={30} color={ClayTheme.colors.textMuted} />
                    </View>
                  )}
                  {image.status === 'QUARANTINED' || image.status === 'REJECTED' ? (
                    <View style={styles.imageReviewBadge}>
                      <Text style={styles.imageReviewText}>{image.status === 'REJECTED' ? 'Rechazada' : 'En revisión'}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar foto ${index + 1}`}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {selectedImages.length < 3 && (
                 <TouchableOpacity onPress={pickImage} style={styles.addImageBtn} accessibilityRole="button" accessibilityLabel="Agregar foto">
                  <MaterialCommunityIcons name="camera-plus" size={30} color={ClayTheme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Título del producto"
                placeholder="Ej: Bicicleta rodado 26"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.title?.message}
              
                ref={ref}
              />
            )}
          />

          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <ClayInput
                label="Precio ($ ARS)"
                placeholder="Dejar vacío si es gratis"
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.price?.message}
              
                ref={ref}
              />
            )}
          />

          <Controller
            control={control}
            name="whatsapp"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <View>
                <ClayInput
                   label="WhatsApp"
                  placeholder="+5491100000000"
                  keyboardType="phone-pad"
                  onBlur={onBlur}
                   onChangeText={onChange}
                  value={value}
                  error={errors.whatsapp?.message}
                
                ref={ref}
              />
                <Text style={{ fontFamily: ClayTheme.typography.fontFamily.medium, fontSize: 11, color: ClayTheme.colors.textMuted, marginLeft: 8, marginTop: 4 }}>
                   {value ? `Se publicará como ${normalizeWhatsApp(value)}` : 'Incluí código de país. Será visible para los vecinos.'}
                </Text>
              </View>
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
            render={({ field: { onChange, onBlur, value, ref } }) => (
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
              
                ref={ref}
              />
            )}
          />

          <ClayButton 
            title={createMutation.isPending || isUploading ? "Guardando..." : (postId ? "Guardar cambios" : "Publicar")} 
            onPress={handleSubmit(onSubmit)} 
            disabled={createMutation.isPending || isUploading || isLoadingPost}
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
    ...ClayTheme.shadows.elevatedSm,
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
  imageReviewBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  imageReviewText: {
    color: 'white',
    fontSize: 9,
    fontFamily: ClayTheme.typography.fontFamily.bold,
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
