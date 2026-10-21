// ============================================================================
// NEURON ACADEMY — DESIGN SYSTEM
// Primary: Royal Blue, Secondary: Gold, Tertiary: White and Silver
// ============================================================================

export const colors = {
  // --- Core Brand Colors ---
  brand: {
    primary: {
      50: '#EEF3FF',
      100: '#DCE6FF',
      200: '#BBCDFA',
      300: '#91AEF0',
      400: '#668CE0',
      500: '#3567D5',
      600: '#2454CE',
      700: '#1B43B0',
      800: '#17368F',
      900: '#122B70',
      950: '#0C1C4D',
    },
    secondary: {
      50: '#FBF7E8',
      100: '#F6EDC8',
      200: '#ECDD9D',
      300: '#E2CB70',
      400: '#D4AF37',
      500: '#C49C25',
      600: '#A98418',
      700: '#886914',
      800: '#695014',
      900: '#4F3B12',
      950: '#302309',
    },
    tertiary: {
      50: '#FFFFFF',
      100: '#F7F9FC',
      200: '#EEF2F8',
      300: '#DCE3EE',
      400: '#B6C0D0',
      500: '#8B98AD',
      600: '#68758A',
      700: '#4D5D75',
      800: '#273A5C',
      900: '#14213D',
      950: '#0A1D50',
    },
  },

  // --- Semantic Colors ---
  semantic: {
    success: {
      light: '#D1FAE5',
      DEFAULT: '#10B981',
      dark: '#059669',
      text: '#065F46',
    },
    warning: {
      light: '#FEF3C7',
      DEFAULT: '#F59E0B',
      dark: '#D97706',
      text: '#92400E',
    },
    error: {
      light: '#FEE2E2',
      DEFAULT: '#EF4444',
      dark: '#DC2626',
      text: '#991B1B',
    },
    info: {
      light: '#DCE6FF',
      DEFAULT: '#1746B8',
      dark: '#123A9A',
      text: '#0A1D50',
    },
  },

  // --- Neutral / Gray Scale ---
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },

  // --- Portal Themes ---
  portal: {
    // Public Website - Clean, professional
    public: {
      primary: '#1746B8',
      primaryHover: '#123A9A',
      primaryLight: '#EEF3FF',
      secondary: '#D4AF37',
      secondaryHover: '#B8901B',
      secondaryLight: '#FBF7E8',
      background: '#FFFFFF',         // Pure White
      surface: '#F7F9FC',
      surfaceAlt: '#EEF2F8',
      card: '#FFFFFF',
      cardHover: '#F7F9FC',
      border: '#DCE3EE',
      borderHover: '#3567D5',
      text: '#0A1D50',
      textSecondary: '#4D5D75',
      textMuted: '#68758A',
      textInverse: '#FFFFFF',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      focus: '#1746B8',
    },

    // Student Portal - Engaging, energetic
    student: {
      primary: '#1746B8',
      primaryHover: '#123A9A',
      primaryLight: '#EEF3FF',
      secondary: '#D4AF37',
      secondaryHover: '#B8901B',
      secondaryLight: '#FBF7E8',
      background: '#F7F9FC',
      surface: '#FFFFFF',
      surfaceAlt: '#EEF2F8',
      card: '#FFFFFF',
      cardHover: '#F7F9FC',
      border: '#DCE3EE',
      borderHover: '#3567D5',
      text: '#0A1D50',
      textSecondary: '#4D5D75',
      textMuted: '#68758A',
      textInverse: '#FFFFFF',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      focus: '#1746B8',
    },

    // Faculty Portal - Professional, calm
    faculty: {
      primary: '#1746B8',
      primaryHover: '#123A9A',
      primaryLight: '#EEF3FF',
      secondary: '#D4AF37',
      secondaryHover: '#B8901B',
      secondaryLight: '#FBF7E8',
      background: '#F7F9FC',
      surface: '#FFFFFF',
      surfaceAlt: '#EEF2F8',
      card: '#FFFFFF',
      cardHover: '#F8FAFC',
      border: '#DCE3EE',
      borderHover: '#3567D5',
      text: '#0A1D50',
      textSecondary: '#4D5D75',
      textMuted: '#68758A',
      textInverse: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      focus: '#1746B8',
    },

    // Admin Portal - Authoritative, clean
    admin: {
      primary: '#1746B8',
      primaryHover: '#123A9A',
      primaryLight: '#EEF3FF',
      secondary: '#D4AF37',
      secondaryHover: '#B8901B',
      secondaryLight: '#FBF7E8',
      background: '#FFFFFF',
      surface: '#F7F9FC',
      surfaceAlt: '#EEF2F8',
      card: '#FFFFFF',
      cardHover: '#F7F9FC',
      border: '#DCE3EE',
      borderHover: '#3567D5',
      text: '#0A1D50',
      textSecondary: '#4D5D75',
      textMuted: '#68758A',
      textInverse: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      focus: '#1746B8',
    },
  },

  // --- Gradients ---
  gradients: {
    primary: 'linear-gradient(135deg, #1746B8 0%, #123A9A 100%)',
    secondary: 'linear-gradient(135deg, #E2CB70 0%, #D4AF37 100%)',
    hero: 'linear-gradient(135deg, #0A1D50 0%, #1746B8 58%, #D4AF37 100%)',
    heroAlt: 'linear-gradient(135deg, #0A1D50 0%, #102B70 58%, #D4AF37 100%)',
    card: 'linear-gradient(145deg, #FFFFFF 0%, #F7F9FC 100%)',
    cardHover: 'linear-gradient(145deg, #F7F9FC 0%, #EEF3FF 100%)',
    metallic: 'linear-gradient(135deg, #FFFFFF 0%, #EEF2F8 52%, #F6EDC8 100%)',
    sunset: 'linear-gradient(135deg, #1746B8 0%, #D4AF37 100%)',
  },

  // --- Shadows ---
  shadows: {
    xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
    sm: '0 1px 3px 0 rgb(15 23 42 / 0.1), 0 1px 2px -1px rgb(15 23 42 / 0.1)',
    DEFAULT: '0 4px 6px -1px rgb(15 23 42 / 0.1), 0 2px 4px -2px rgb(15 23 42 / 0.1)',
    md: '0 10px 15px -3px rgb(15 23 42 / 0.1), 0 4px 6px -4px rgb(15 23 42 / 0.1)',
    lg: '0 20px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.1)',
    xl: '0 25px 50px -12px rgb(15 23 42 / 0.15)',
    '2xl': '0 35px 60px -15px rgb(15 23 42 / 0.2)',
    inner: 'inset 0 2px 4px 0 rgb(15 23 42 / 0.05)',
    // Colored shadows
    primary: '0 10px 32px -12px rgb(23 70 184 / 0.28)',
    secondary: '0 10px 32px -12px rgb(212 175 55 / 0.3)',
    card: '0 4px 20px -2px rgb(15 23 42 / 0.08)',
    cardHover: '0 20px 40px -10px rgb(15 23 42 / 0.12)',
  },

  // --- Text Colors for Accessibility ---
  text: {
    onPrimary: '#FFFFFF',
    onSecondary: '#0A1D50',
    onPrimaryContainer: '#0A1D50',
    onSecondaryContainer: '#4F3B12',
    onSurface: '#14213D',
    onSurfaceVariant: '#4D5D75',
    onBackground: '#14213D',
    onError: '#FFFFFF',
    onSuccess: '#FFFFFF',
    onWarning: '#111827',
    // High contrast variants
    highContrast: '#0A1D50',
    mediumContrast: '#4D5D75',
    lowContrast: '#68758A',
  },
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// ---------------------------------------------------------------------------

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    display: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
  },

  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.02em' }],
    sm: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
    base: ['1rem', { lineHeight: '1.6', letterSpacing: '0' }],
    lg: ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
    xl: ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
    '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
    '3xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
    '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
    '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
    '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
    '7xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.04em' }],
  },

  // Semantic text styles
  textStyle: {
    display: { fontSize: '4.5rem', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.04em' },
    h1: { fontSize: '3.75rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em' },
    h2: { fontSize: '3rem', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em' },
    h3: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.03em' },
    h4: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
    h5: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.02em' },
    h6: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em' },
    bodyLg: { fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.6, letterSpacing: 0 },
    body: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.6, letterSpacing: 0 },
    bodySm: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.01em' },
    caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.02em' },
    overline: { fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' },
    button: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.01em' },
  },
} as const;

// ---------------------------------------------------------------------------
// SPACING (8px base grid)
// ---------------------------------------------------------------------------

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
} as const;

// ---------------------------------------------------------------------------
// BORDER RADIUS
// ---------------------------------------------------------------------------

export const radius = {
  none: '0',
  sm: '0.375rem',    // 6px
  DEFAULT: '0.5rem', // 8px
  md: '0.75rem',     // 12px
  lg: '1rem',        // 16px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '2rem',     // 32px
  full: '9999px',
} as const;

// ---------------------------------------------------------------------------
// BORDER WIDTH
// ---------------------------------------------------------------------------

export const borderWidth = {
  DEFAULT: '1px',
  2: '2px',
  3: '3px',
  4: '4px',
} as const;

// ---------------------------------------------------------------------------
// TRANSITIONS
// ---------------------------------------------------------------------------

export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  DEFAULT: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ---------------------------------------------------------------------------
// Z-INDEX
// ---------------------------------------------------------------------------

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 1000,
  popover: 1100,
  tooltip: 1200,
  toast: 1300,
} as const;

// ---------------------------------------------------------------------------
// BREAKPOINTS
// ---------------------------------------------------------------------------

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ---------------------------------------------------------------------------
// ANIMATION DURATIONS
// ---------------------------------------------------------------------------

export const animation = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

// ---------------------------------------------------------------------------
// TYPE EXPORTS
// ---------------------------------------------------------------------------

export type PortalTheme = 'public' | 'student' | 'faculty' | 'admin';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'metallic'
  | 'accent'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'glass' | 'metallic';

export type InputVariant = 'default' | 'filled' | 'outlined' | 'ghost';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'teal' | 'navy' | 'red' | 'silver';

export type InputSize = 'sm' | 'md' | 'lg';

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getPortalTheme(portal: PortalTheme) {
  return colors.portal[portal];
}

export function getPortalCSSVariables(portal: PortalTheme): Record<string, string> {
  const theme = colors.portal[portal];
  return {
    '--color-primary': theme.primary,
    '--color-primary-hover': theme.primaryHover,
    '--color-primary-light': theme.primaryLight,
    '--color-secondary': theme.secondary,
    '--color-secondary-hover': theme.secondaryHover,
    '--color-secondary-light': theme.secondaryLight,
    '--color-background': theme.background,
    '--color-surface': theme.surface,
    '--color-surface-alt': theme.surfaceAlt,
    '--color-card': theme.card,
    '--color-card-hover': theme.cardHover,
    '--color-border': theme.border,
    '--color-border-hover': theme.borderHover,
    '--color-text': theme.text,
    '--color-text-secondary': theme.textSecondary,
    '--color-text-muted': theme.textMuted,
    '--color-text-inverse': theme.textInverse,
    '--color-success': theme.success,
    '--color-warning': theme.warning,
    '--color-error': theme.error,
    '--color-focus': theme.focus,
    '--shadow-primary': colors.shadows.primary,
    '--shadow-secondary': colors.shadows.secondary,
    '--shadow-card': colors.shadows.card,
    '--shadow-card-hover': colors.shadows.cardHover,
  };
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

export const designSystem = {
  colors,
  typography,
  spacing,
  radius,
  borderWidth,
  shadows: colors.shadows,
  transition,
  zIndex,
  breakpoints,
  animation,
  cn,
  getPortalTheme,
  getPortalCSSVariables,
} as const;

export default designSystem;
