/**
 * Minimal shared design tokens (colors/spacing/radii/typography).
 * No visual reference file was provided for this project, so these are a
 * reasonable warm/neutral baseline per PRD Usability NFR ("giọng điệu ấm áp").
 * Reused across screens — extend here rather than hardcoding hex values in components.
 */

export const colors = {
  background: '#FFF8F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F1E9E0',
  primary: '#E08A3E',
  primaryDark: '#C06F27',
  accent: '#4C9A7D',
  text: '#2E2A26',
  textMuted: '#7A7167',
  border: '#E7DDD0',
  danger: '#B5482F',
  overlay: 'rgba(46, 42, 38, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const typography = {
  title: { fontSize: 20, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
