/**
 * Paleta e tokens visuais do Evolvi Fit.
 * Identidade escura e premium: superfícies em navy profundo com acento violeta elétrico.
 */

import { Platform, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1020',
    background: '#F4F6FB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8ECF8',
    textSecondary: '#5B6475',
    border: '#E1E6F0',
    primarySoft: '#ECEBFF',
    successSoft: '#E6F9EC',
    dangerSoft: '#FDECEE',
    warningSoft: '#FEF5E3',
  },
  dark: {
    text: '#F3F5FA',
    background: '#06070B',
    backgroundElement: '#0D1322',
    backgroundSelected: '#151C2E',
    textSecondary: '#909AB0',
    border: 'rgba(255, 255, 255, 0.08)',
    primarySoft: 'rgba(124, 92, 245, 0.14)',
    successSoft: 'rgba(74, 222, 128, 0.12)',
    dangerSoft: 'rgba(240, 97, 107, 0.12)',
    warningSoft: 'rgba(245, 181, 68, 0.14)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Brand = {
  primary: '#7C5CF5',
  primaryDark: '#5B3FD4',
  primaryDeep: '#3E2A99',
  accent: '#22D3EE',
  accentDark: '#06B6D4',
  danger: '#F0616B',
  dangerDark: '#C0353A',
  success: '#4ADE80',
  warning: '#F5B544',
} as const;

export const Gradients = {
  primary: ['#5B3FD4', '#7C5CF5'],
  accent: ['#06B6D4', '#22D3EE'],
  success: ['#22A06B', '#4ADE80'],
  danger: ['#F0616B', '#C0353A'],
} as const satisfies Record<string, readonly [string, string, ...string[]]>;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const CardShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 3 },
  default: {},
});

/** Converte um hex (#RGB ou #RRGGBB) em rgba com a opacidade desejada. */
export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const value = Number.parseInt(full.slice(0, 6), 16);

  if (Number.isNaN(value)) return hex;

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 760;
