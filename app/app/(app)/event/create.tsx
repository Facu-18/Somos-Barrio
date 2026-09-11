import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { ClayTheme } from '../../../constants/ClayTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClayInput } from '../../../components/ClayInput';
import { ClayButton } from '../../../components/ClayButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// Configurar calendario en español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene.', 'Feb.', 'Mar', 'Abr', 'May', 'Jun', 'Jul.', 'Ago', 'Sept.', 'Oct.', 'Nov.', 'Dic.'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

export default function CreateEventScreen() {
  const { data: user } = useAuth();
  const barrioSlug = user!.barrio!.slug;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState(''); // HH:MM
  const [showCalendar, setShowCalendar] = useState(false);

  const formatDateString = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const parseDateTime = () => {
    if (!selectedDate || !timeStr) return null;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const timeParts = timeStr.split(':');
    if (timeParts.length !== 2) return null;

    const hour = parseInt(timeParts[0], 10);
    const min = parseInt(timeParts[1], 10);

    const d = new Date(year, month - 1, day, hour, min);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !location.trim()) {
        throw new Error('El título y la ubicación son obligatorios.');
      }
      
      const parsedDate = parseDateTime();
      if (!parsedDate) {
        throw new Error('Debés seleccionar una fecha y escribir una hora válida (HH:MM).');
      }

      if (parsedDate.getTime() < Date.now()) {
        throw new Error('La fecha y hora deben ser en el futuro.');
      }

      const payload = {
        title: title.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
        date: parsedDate.toISOString(),
      };

      await api.post(`/barrios/${barrioSlug}/events`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', barrioSlug] });
      router.back();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error.message || 'Error al crear el evento.';
      Alert.alert('No se pudo crear', msg);
    }
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={24} color={ClayTheme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo evento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <ClayInput
            label="Título"
            placeholder="Ej. Torneo de Truco"
            value={title}
            onChangeText={setTitle}
            containerStyle={styles.inputSpacing}
          />

          <ClayInput
            label="Ubicación"
            placeholder="Ej. Club Social"
            value={location}
            onChangeText={setLocation}
            containerStyle={styles.inputSpacing}
          />

          <View style={styles.row}>
            <View style={[styles.inputSpacing, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Fecha</Text>
              <TouchableOpacity 
                style={styles.dateButton} 
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.7}
              >
                <Text style={selectedDate ? styles.dateText : styles.datePlaceholder}>
                  {selectedDate ? formatDateString(selectedDate) : 'DD/MM/AAAA'}
                </Text>
                <MaterialCommunityIcons name="calendar" size={20} color={ClayTheme.colors.primary} />
              </TouchableOpacity>
            </View>

            <ClayInput
              label="Hora (HH:MM)"
              placeholder="Ej. 18:30"
              value={timeStr}
              onChangeText={setTimeStr}
              containerStyle={[styles.inputSpacing, { flex: 1 }]}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>

          <ClayInput
            label="Descripción (Opcional)"
            placeholder="Contá de qué se trata, requisitos, etc..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            containerStyle={styles.inputSpacing}
          />

          <ClayButton
            title={mutation.isPending ? 'Creando...' : 'Crear evento'}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim() || !location.trim()}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>

      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Calendar
              onDayPress={(day: any) => {
                setSelectedDate(day.dateString);
                setShowCalendar(false);
              }}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: ClayTheme.colors.primary }
              }}
              minDate={new Date().toISOString().split('T')[0]}
              theme={{
                todayTextColor: ClayTheme.colors.primary,
                arrowColor: ClayTheme.colors.text,
                textDayFontFamily: ClayTheme.typography.fontFamily.medium,
                textMonthFontFamily: ClayTheme.typography.fontFamily.extraBold,
                textDayHeaderFontFamily: ClayTheme.typography.fontFamily.bold,
              }}
            />
            <ClayButton 
              title="Cancelar" 
              onPress={() => setShowCalendar(false)} 
              style={styles.modalCancelBtn} 
            />
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ClayTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...ClayTheme.shadows.elevated,
  },
  headerTitle: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 20,
    color: ClayTheme.colors.text,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 28,
    padding: 24,
    ...ClayTheme.shadows.elevated,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  inputSpacing: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: ClayTheme.typography.fontFamily.extraBold,
    fontSize: 14,
    color: ClayTheme.colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  dateButton: {
    height: 52,
    backgroundColor: ClayTheme.colors.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...ClayTheme.shadows.sunk,
  },
  datePlaceholder: {
    fontFamily: ClayTheme.typography.fontFamily.semiBold,
    fontSize: 15,
    color: '#B0A596',
  },
  dateText: {
    fontFamily: ClayTheme.typography.fontFamily.bold,
    fontSize: 15,
    color: ClayTheme.colors.textInput,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  submitButton: {
    width: '100%',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: ClayTheme.colors.surface,
    borderRadius: 28,
    padding: 20,
    ...ClayTheme.shadows.elevated,
  },
  modalCancelBtn: {
    marginTop: 16,
    backgroundColor: ClayTheme.colors.errorBg,
  }
});
