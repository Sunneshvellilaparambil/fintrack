// FinTrack Design System — Modern Edition
export const Colors = {
  // Background layers (deep dark with blue tint)
  bg: '#080C14',
  bgCard: '#0D1220',
  bgCardAlt: '#111828',
  bgElevated: '#192030',
  bgGlass: 'rgba(13,18,32,0.85)',

  // Brand — vivid indigo / violet
  primary: '#7C6EFF',
  primaryLight: '#A89BFF',
  primaryDark: '#5A4ECC',
  primaryGlow: 'rgba(124,110,255,0.25)',

  // Semantic
  success: '#00E5A0',
  successDim: 'rgba(0,229,160,0.12)',
  successGlow: 'rgba(0,229,160,0.25)',
  warning: '#FFCA5A',
  warningDim: 'rgba(255,202,90,0.12)',
  danger: '#FF6B6B',
  dangerDim: 'rgba(255,107,107,0.12)',
  dangerGlow: 'rgba(255,107,107,0.25)',
  info: '#4ECFF7',
  infoDim: 'rgba(78,207,247,0.12)',

  // Text
  textPrimary: '#F0F4FF',
  textSecondary: '#8A95B0',
  textMuted: '#4A5470',
  textInverse: '#080C14',

  // Borders
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(124,110,255,0.45)',
  borderGlass: 'rgba(255,255,255,0.10)',

  // Gradients
  gradientPrimary: ['#7C6EFF', '#5A4ECC'] as string[],
  gradientSuccess: ['#00E5A0', '#00B87E'] as string[],
  gradientWarm: ['#FFCA5A', '#FF8A30'] as string[],
  gradientDanger: ['#FF6B6B', '#CC3344'] as string[],
  gradientDark: ['#0D1220', '#192030'] as string[],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  giant: 44,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const Shadow = {
  card: {
    shadowColor: '#7C6EFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#7C6EFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  success: {
    shadowColor: '#00E5A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  danger: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
