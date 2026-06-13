/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand palette (mirrors web app)
        brand: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
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
        jade: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['NotoSansSC_400Regular', 'System'],
        'sans-medium': ['NotoSansSC_500Medium', 'System'],
        'sans-semibold': ['NotoSansSC_600SemiBold', 'System'],
        'sans-bold': ['NotoSansSC_700Bold', 'System'],
      },
    },
  },
  plugins: [],
};
