import { Platform } from 'react-native';
import type { BoxShadowValue, ViewStyle } from 'react-native';

/**
 * Sistema clay · Somos Barrio
 *
 * Claymorfismo minimalista: el relieve lo hace la sombra, nunca un borde.
 * Regla del sistema: CERO bordes de contorno. Si algo necesita separarse,
 * se separa por elevación o por aire; para una línea divisoria real usá
 * `colors.divider` en un View de 1px, no un `borderWidth`.
 *
 * Las sombras usan `boxShadow` (RN 0.76+, requiere New Architecture — activada
 * en app.json). Cada nivel son 2 sombras internas (luz arriba-izquierda,
 * sombra abajo-derecha) + una externa difusa del color de la superficie.
 */

/**
 * IMPORTANTE — por qué esto no usa `boxShadow` en Android.
 *
 * Los drawables de Android (Inset/OutsetBoxShadowDrawable) dibujan con
 * `BlurMaskFilter`, que NO está acelerado por hardware: cada vista con
 * `boxShadow` cae a renderizado por software y se re-rasteriza en CPU en cada
 * scroll. Con 3 sombras por tarjeta dentro de una FlatList eso hunde a un
 * equipo de gama baja (probado en un Moto G20 / Helio G35).
 *
 * En Android usamos `elevation`, que va por el sistema de RenderNode (GPU) y
 * es prácticamente gratis; RN mapea `shadowColor` a los colores de sombra del
 * outline en API 28+, así que el tono cálido se conserva. Se pierde la luz
 * interna, que era la parte más sutil del efecto: el volumen lo sostienen la
 * caída externa, los radios generosos y la paleta.
 *
 * En iOS sí va la receta completa: las sombras son baratas y los equipos van
 * sobrados.
 */
const shadow = (
  offsetX: number,
  offsetY: number,
  blurRadius: number,
  color: string,
  inset?: boolean,
): BoxShadowValue => ({ offsetX, offsetY, blurRadius, color, ...(inset ? { inset: true } : null) });

const isAndroid = Platform.OS === 'android';

/** Sombra cálida por hardware en Android; receta clay completa en iOS. */
const depth = (elevation: number, shadowColor: string, ios: BoxShadowValue[]): ViewStyle =>
  isAndroid ? { elevation, shadowColor } : { boxShadow: ios };

/** Luz blanca arriba-izquierda + sombra cálida abajo-derecha + caída externa. */
const elevated = depth(5, '#8A7D6B', [
  shadow(2, 2, 4, 'rgba(255,255,255,0.95)', true),
  shadow(-3, -4, 7, 'rgba(186,176,161,0.32)', true),
  shadow(9, 13, 26, 'rgba(176,165,150,0.26)'),
]);

/** Mismo relieve, menos aire: avatares, íconos, botones chicos. */
const elevatedSm = depth(2, '#8A7D6B', [
  shadow(1, 1, 2, 'rgba(255,255,255,0.95)', true),
  shadow(-2, -2, 4, 'rgba(186,176,161,0.30)', true),
  shadow(4, 6, 13, 'rgba(176,165,150,0.22)'),
]);

/**
 * Hundido: la inversa del elevado. Inputs, buscadores, tracks de segmented.
 * `elevation` no puede hacer sombra interna, así que en Android el hundido lo
 * marca el contraste de fondo (`inputBg` sobre `surface`/`background`).
 */
const sunk: ViewStyle = isAndroid
  ? {}
  : {
      boxShadow: [
        shadow(4, 5, 9, 'rgba(181,171,156,0.45)', true),
        shadow(-3, -3, 7, 'rgba(255,255,255,0.95)', true),
      ],
    };

/** Hundido en clave de error, para un input inválido. */
const sunkError: ViewStyle = isAndroid
  ? {}
  : {
      boxShadow: [
        shadow(4, 5, 9, 'rgba(196,150,140,0.42)', true),
        shadow(-3, -3, 7, 'rgba(255,255,255,0.92)', true),
      ],
    };

/** Superficie de color: la caída externa toma el tono de la superficie. */
const tinted = (elevationColor: string, dark: string, glow: string): ViewStyle =>
  depth(5, elevationColor, [
    shadow(2, 2, 4, 'rgba(255,255,255,0.50)', true),
    shadow(-3, -4, 8, dark, true),
    shadow(8, 12, 24, glow),
  ]);

export const ClayTheme = {
  colors: {
    background: '#F2F0EB', // Arcilla cruda: fondo de toda pantalla
    surface: '#FAF8F5', // Cards, botones secundarios, tab bar
    surfaceFlat: '#EBE8E1', // Chips inactivos, fondos planos (sin sombra)

    primary: '#7BC47F',
    primaryText: '#1F4A26', // Texto sobre primary: el blanco queda en 2:1
    primaryDark: '#3B7A41', // Label de tab activa, precio destacado
    primarySoft: '#E1EFE2', // Fondo de chip/avatar en clave primaria

    secondary: '#F0A868', // Terracota
    accent: '#8FB8DE', // Celeste polvoriento

    text: '#3B3733',
    textBody: '#4A443E', // Cuerpo de texto largo
    textInput: '#756C63', // Texto chico: #8A827A no llega a 4.5:1
    textMuted: '#8A827A', // Sólo 14px+ o metadatos no críticos
    textFaint: '#9A9188', // Placeholders, íconos inactivos

    inputBg: '#EDEAE3', // Superficie hundida
    divider: '#E3DED4', // Línea divisoria (View de 1px, nunca borderWidth)

    error: '#B4553F',
    errorBg: '#F4E7E2',
    errorSoft: '#F7E0D2',
  },

  /**
   * Colores por categoría del backend (NewsCategory, BusinessCategory,
   * MarketplaceCategory). Fuente única: no redefinir estos pares por pantalla.
   */
  categories: {
    // NewsCategory
    SEGURIDAD: { bg: '#F7E0D2', text: '#9A5227', dot: '#E08A5A' },
    OBRAS: { bg: '#F6EBD2', text: '#856520', dot: '#D9B45C' },
    EVENTOS: { bg: '#E2ECF6', text: '#3E6288', dot: '#8FB8DE' },
    MUNICIPIO: { bg: '#EAE7F2', text: '#57508A', dot: '#A79FC6' },
    COMUNIDAD: { bg: '#E1EFE2', text: '#35663A', dot: '#7BC47F' },
    // BusinessCategory
    GASTRONOMIA: { bg: '#F7E0D2', text: '#9A5227', dot: '#E08A5A' },
    SALUD: { bg: '#E2ECF6', text: '#3E6288', dot: '#8FB8DE' },
    EDUCACION: { bg: '#F6EBD2', text: '#856520', dot: '#D9B45C' },
    SERVICIOS: { bg: '#EAE7F2', text: '#57508A', dot: '#A79FC6' },
    HOGAR: { bg: '#E6EFE7', text: '#35663A', dot: '#7BC47F' },
    DEPORTES: { bg: '#E4EDF6', text: '#3E6288', dot: '#8FB8DE' },
    // MarketplaceCategory
    ELECTRONICA: { bg: '#EAE7F2', text: '#57508A', dot: '#A79FC6' },
    ROPA: { bg: '#F7E0D2', text: '#9A5227', dot: '#E08A5A' },
    MUEBLES: { bg: '#F6EBD2', text: '#856520', dot: '#D9B45C' },
    SE_BUSCA: { bg: '#E2ECF6', text: '#3E6288', dot: '#8FB8DE' },
    SE_REGALA: { bg: '#E1EFE2', text: '#35663A', dot: '#7BC47F' },
    OTROS: { bg: '#EBE8E1', text: '#756C63', dot: '#9A9188' },
  } as const,

  /** Estados de publicación del marketplace y de moderación. */
  states: {
    positive: { bg: '#E1EFE2', text: '#35663A' },
    warning: { bg: '#F6EBD2', text: '#856520' },
    neutral: { bg: '#EBE8E1', text: '#756C63' },
    danger: { bg: '#F4E7E2', text: '#B4553F' },
    info: { bg: '#E2ECF6', text: '#3E6288' },
  } as const,

  typography: {
    fontFamily: {
      regular: 'Nunito_400Regular',
      medium: 'Nunito_500Medium',
      semiBold: 'Nunito_600SemiBold',
      bold: 'Nunito_700Bold',
      extraBold: 'Nunito_800ExtraBold',
    },
    /** Escala corta. Nada de mayúsculas forzadas ni letter-spacing expandido. */
    size: {
      title: 26, // Encabezado de pantalla
      heading: 20, // Título de sección
      cardTitle: 19,
      subtitle: 17,
      body: 15,
      bodySm: 14,
      label: 13,
      meta: 12,
      badge: 11,
      tab: 10,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 44,
  },

  borders: {
    radiusSunk: 20, // Inputs
    radiusElevated: 28, // Cards, tab bar
    radiusTile: 22, // Tiles e íconos cuadrados
    radiusMedia: 19, // Miniaturas dentro de una card
    radiusPill: 999,
  },

  /** Alto mínimo de toque. Nada interactivo por debajo de esto. */
  hitSize: 44,

  shadows: {
    elevated,
    elevatedSm,
    sunk,
    sunkError,
    /** Para cancelar el relieve heredado por un estilo previo. */
    none: (isAndroid ? { elevation: 0 } : { boxShadow: undefined }) as ViewStyle,
    /** Verde de marca de WhatsApp: es color de marca, no del sistema. */
    whatsapp: depth(5, '#128C7E', [shadow(0, 10, 22, 'rgba(37,211,102,0.32)')]),
    primary: tinted('#3E7A43', 'rgba(74,131,78,0.42)', 'rgba(123,196,127,0.34)'),
    secondary: tinted('#A3651F', 'rgba(178,110,50,0.38)', 'rgba(240,168,104,0.32)'),
    accent: tinted('#4A6E93', 'rgba(84,124,164,0.35)', 'rgba(143,184,222,0.32)'),
  },
} as const;

export type CategoryKey = keyof typeof ClayTheme.categories;

/** Par de colores de una categoría; cae en el neutro si llega una desconocida. */
export const categoryStyle = (category: string) =>
  ClayTheme.categories[category?.toUpperCase() as CategoryKey] ?? ClayTheme.categories.OTROS;

/** "SEGURIDAD" -> "Seguridad". El sistema no usa mayúsculas forzadas. */
export const categoryLabel = (category: string) =>
  category ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() : '';
