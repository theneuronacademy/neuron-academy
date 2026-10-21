// ============================================================================
// NEURON ACADEMY — METALLIC DESIGN SYSTEM
// Premium educational UI with distinct portal identities
// ============================================================================

// ---------------------------------------------------------------------------
// COLOR TOKENS — Metallic palette with semantic meaning
// ---------------------------------------------------------------------------

export const colors = {
  // --- Base neutrals (metallic greys) ---
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },

  // --- Metallic accents ---
  metallic: {
    // Platinum / Silver family
    platinum: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    // Champagne / Gold family
    champagne: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
    // Bronze / Copper family
    bronze: {
      50: '#fef7ed',
      100: '#feedde',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    // Steel / Blue-grey family
    steel: {
      50: '#f0f4f8',
      100: '#d9e2ec',
      200: '#bcccdc',
      300: '#9fb3c8',
      400: '#829ab1',
      500: '#627d98',
      600: '#486581',
      700: '#334e68',
      800: '#243b53',
      900: '#102a43',
    },
  },

  // --- Portal identities ---
  portal: {
    // Public website — sophisticated platinum
    public: {
      primary: '#1e293b',        // platinum-800
      primaryHover: '#334155',   // platinum-700
      primaryLight: '#f1f5f9',   // platinum-100
      accent: '#eab308',         // champagne-500
      accentHover: '#ca8a04',    // champagne-600
      accentLight: '#fef9c3',    // champagne-100
      surface: '#ffffff',
      surfaceAlt: '#f8fafc',     // platinum-50
      border: '#e2e8f0',         // platinum-200
      text: '#0f172a',           // platinum-900
      textMuted: '#64748b',      // platinum-500
      success: '#16a34a',        // green-600
      warning: '#eab308',        // amber-500
      error: '#ef4444',          // red-500
    },

    // Student portal — warm champagne/gold (energetic, aspirational)
    student: {
      primary: '#7c2d12',        // bronze-900
      primaryHover: '#9a3412',   // bronze-800
      primaryLight: '#fef7ed',   // bronze-50
      accent: '#eab308',         // champagne-500
      accentHover: '#ca8a04',    // champagne-600
      accentLight: '#fef9c3',    // champagne-100
      surface: '#fffef7',
      surfaceAlt: '#fefce8',     // champagne-50
      border: '#fde047',         // champagne-300
      text: '#431407',           // bronze-950
      textMuted: '#a16207',      // champagne-700
      success: '#166534',        // emerald-800
      warning: '#854d0e',        // champagne-800
      error: '#991b1b',          // red-800
    },

    // Faculty portal — professional steel (authoritative, calm)
    faculty: {
      primary: '#102a43',        // steel-900
      primaryHover: '#243b53',   // steel-800
      primaryLight: '#f0f4f8',   // steel-50
      accent: '#486581',         // steel-500
      accentHover: '#334e68',    // steel-700
      accentLight: '#d9e2ec',    // steel-100
      surface: '#f8fafc',
      surfaceAlt: '#f0f4f8',     // steel-50
      border: '#bcccdc',         // steel-200
      text: '#0d1b2a',
      textMuted: '#627d98',      // steel-500
      success: '#14532d',        // green-800
      warning: '#7c2d12',        // bronze-900
      error: '#7f1d1d',          // red-900
    },

    // Admin portal — deep platinum (commanding, serious)
    admin: {
      primary: '#09090b',        // neutral-950
      primaryHover: '#18181b',   // neutral-900
      primaryLight: '#fafafa',   // neutral-50
      accent: '#eab308',         // champagne-500
      accentHover: '#ca8a04',    // champagne-600
      accentLight: '#fef9c3',    // champagne-100
      surface: '#ffffff',
      surfaceAlt: '#f4f4f5',     // neutral-100
      border: '#d4d4d8',         // neutral-300
      text: '#09090b',           // neutral-950
      textMuted: '#71717a',      // neutral-500
      success: '#15803d',        // green-700
      warning: '#a16207',        // champagne-700
      error: '#b91c1c',          // red-700
    },
  },

  // --- Semantic colors (shared) ---
  semantic: {
    success: {
      light: '#dcfce7',
      DEFAULT: '#16a34a',
      dark: '#15803d',
      text: '#14532d',
    },
    warning: {
      light: '#fef9c3',
      DEFAULT: '#eab308',
      dark: '#a16207',
      text: '#713f12',
    },
    error: {
      light: '#fee2e2',
      DEFAULT: '#ef4444',
      dark: '#b91c1c',
      text: '#7f1d1d',
    },
    info: {
      light: '#dbeafe',
      DEFAULT: '#3b82f6',
      dark: '#2563eb',
      text: '#1e3a5f',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY SCALE — Harmonious modular scale
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

  // Modular scale: 1.25 (major third)
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.02em' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],     // 14px
    base: ['1rem', { lineHeight: '1.6', letterSpacing: '0' }],            // 16px
    lg: ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],    // 18px
    xl: ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],     // 20px
    '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],   // 24px
    '3xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.03em' }],  // 36px
    '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],    // 48px
    '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],  // 60px
    '7xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.04em' }],  // 72px
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
    overline: { fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' },
    button: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.01em' },
  },
} as const;

// ---------------------------------------------------------------------------
// SPACING — 8px base grid
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
// ELEVATION / SHADOWS — Metallic depth
// ---------------------------------------------------------------------------

export const elevation = {
  none: 'none',
  level1: '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 1px rgb(0 0 0 / 0.02)',           // Subtle
  level2: '0 4px 6px -1px rgb(0 0 0 / 0.04), 0 2px 4px -2px rgb(0 0 0 / 0.03)',       // Card
  level3: '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.04)',     // Elevated
  level4: '0 20px 25px -5px rgb(0 0 0 / 0.06), 0 8px 10px -6px rgb(0 0 0 / 0.04)',    // Modal
  level5: '0 25px 50px -12px rgb(0 0 0 / 0.1), 0 12px 24px -8px rgb(0 0 0 / 0.06)',   // Popover
  // Metallic variants (subtle colored shadows)
  metallic: {
    platinum: '0 4px 20px -2px rgb(30 41 59 / 0.15), 0 2px 8px -2px rgb(30 41 59 / 0.1)',
    champagne: '0 4px 20px -2px rgb(234 179 8 / 0.15), 0 2px 8px -2px rgb(234 179 8 / 0.1)',
    bronze: '0 4px 20px -2px rgb(124 45 18 / 0.15), 0 2px 8px -2px rgb(124 45 18 / 0.1)',
    steel: '0 4px 20px -2px rgb(16 26 43 / 0.15), 0 2px 8px -2px rgb(16 26 43 / 0.1)',
  },
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
// TRANSITIONS
// ---------------------------------------------------------------------------

export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ---------------------------------------------------------------------------
// Z-INDEX SCALE
// ---------------------------------------------------------------------------

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
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
// PORTAL THEME HELPER
// ---------------------------------------------------------------------------

export type PortalTheme = 'public' | 'student' | 'faculty' | 'admin';

export function getPortalTheme(portal: PortalTheme) {
  return colors.portal[portal];
}

export function getPortalCSSVariables(portal: PortalTheme): Record<string, string> {
  const theme = colors.portal[portal];
  return {
    '--color-primary': theme.primary,
    '--color-primary-hover': theme.primaryHover,
    '--color-primary-light': theme.primaryLight,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-accent-light': theme.accentLight,
    '--color-surface': theme.surface,
    '--color-surface-alt': theme.surfaceAlt,
    '--color-border': theme.border,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-success': theme.success ?? colors.semantic.success.dark,
    '--color-warning': theme.warning ?? colors.semantic.warning.dark,
    '--color-error': theme.error ?? colors.semantic.error.dark,
    '--shadow-metallic': elevation.metallic[portal === 'student' ? 'champagne' : portal === 'faculty' ? 'steel' : 'platinum'],
  };
}

// ---------------------------------------------------------------------------
// UTILITY: Generate Tailwind-compatible class strings
// ---------------------------------------------------------------------------

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// COMPONENT VARIANT TYPES
// ---------------------------------------------------------------------------

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'metallic'
  | 'accent'
  | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'metallic' | 'glass';

export type InputVariant = 'default' | 'filled' | 'outlined' | 'ghost';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'metallic' | 'teal' | 'navy' | 'red' | 'silver';

export type PortalType = 'public' | 'student' | 'faculty' | 'admin';

// ---------------------------------------------------------------------------
// EXPORT ALL
// ---------------------------------------------------------------------------

export const designSystem = {
  colors,
  typography,
  spacing,
  elevation,
  radius,
  transition,
  zIndex,
  breakpoints,
  getPortalTheme,
  getPortalCSSVariables,
  cn,
} as const;

export default designSystem;