// Centralised theme tokens. Use these in StyleSheet.create calls.
export const colors = {
  brand: {
    50: '#faf5ff',
    100: '#f3e8ff',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
  },
  accent: {
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
  },
  ink: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
};

export const gradients = {
  brand: ['#8b5cf6', '#ec4899'] as const,
  brandSoft: ['rgba(139,92,246,0.15)', 'rgba(236,72,153,0.10)'] as const,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
};

export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40,
};
