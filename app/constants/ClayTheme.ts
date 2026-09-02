export const ClayTheme = {
  colors: {
    background: '#F2F0EB', // Default background
    surface: '#FAF8F5',    // Cards, flat surfaces
    primary: '#7BC47F',    // Green buttons
    primaryText: '#1F4A26',
    secondary: '#F0A868',  // Terra
    accent: '#8FB8DE',     // Sky
    text: '#3B3733',       // Main text
    textMuted: '#8A827A',  // Subtitles
    textInput: '#756C63',
    inputBg: '#EDEAE3',    // Sunk background
    error: '#B4553F',      // Redish error
    errorBg: '#F4E7E2',
  },
  typography: {
    fontFamily: {
      regular: 'Nunito_400Regular',
      medium: 'Nunito_500Medium',
      semiBold: 'Nunito_600SemiBold',
      bold: 'Nunito_700Bold',
      extraBold: 'Nunito_800ExtraBold',
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
    radiusSunk: 20,
    radiusElevated: 24,
    radiusPill: 999,
  },
  shadows: {
    elevated: {
      shadowColor: '#B0A596',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 6, // Android
    },
    // Sunk effect approximated with subtle inner-like borders for RN
    sunk: {
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderColor: 'rgba(181, 171, 156, 0.2)',
    }
  }
};
