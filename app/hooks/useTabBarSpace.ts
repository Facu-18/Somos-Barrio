import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 70;
const FAB_GAP = 16;
const LIST_GAP = 24;

/**
 * Medidas de la tab bar flotante. React Navigation no reserva espacio para una barra con
 * `position: 'absolute'`, así que FABs y listas se ubican con estos valores en vez de números fijos.
 * Con edge-to-edge en Android, `insets.bottom` incluye la barra de gestos o de botones del sistema.
 */
export function useTabBarSpace(fabSize = 0) {
  const insets = useSafeAreaInsets();
  const barBottom = Math.max(16, insets.bottom + 8);
  const barTop = barBottom + TAB_BAR_HEIGHT;
  const fabBottom = barTop + FAB_GAP;

  return {
    barBottom,
    fabBottom,
    // Espacio para que el último ítem quede por encima de la barra (y del FAB, si la vista tiene uno).
    listPaddingBottom: fabSize > 0 ? fabBottom + fabSize + FAB_GAP : barTop + LIST_GAP,
  };
}

/** Padding inferior para formularios: el botón final no queda debajo de la barra del sistema. */
export function useFormBottomPadding(base = 32) {
  const insets = useSafeAreaInsets();
  return insets.bottom + base;
}
