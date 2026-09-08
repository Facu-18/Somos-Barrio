import { Platform } from 'react-native';

/**
 * Ajustes de virtualización para FlatList, calibrados para gama baja
 * (probado contra un Moto G20: Helio G35, 4 GB).
 *
 * Por defecto `windowSize` es 21, o sea que RN mantiene montadas ~10 pantallas
 * de contenido hacia arriba y ~10 hacia abajo. En un equipo así eso es memoria
 * y trabajo de layout que no se usa. Con 7 se cubre sobradamente el scroll y
 * baja mucho la presión.
 *
 * `removeClippedSubviews` despega del árbol nativo las filas fuera de vista;
 * en Android es la ganancia más grande de la lista. Se deja sólo en Android:
 * en iOS aporta poco y tiene casos borde conocidos.
 */
export const listPerf = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 5,
  updateCellsBatchingPeriod: 60,
  windowSize: 7,
  removeClippedSubviews: Platform.OS === 'android',
} as const;
