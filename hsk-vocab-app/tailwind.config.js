/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f2',
          100: '#fde3e3',
          200: '#fbcbcb',
          300: '#f7a6a6',
          400: '#f17474',
          500: '#e84848',
          600: '#d42b2b',
          700: '#b21f1f',
          800: '#931d1d',
          900: '#7a1e1e',
        },
        jade: {
          50: '#edfcf5',
          100: '#d2f7e5',
          200: '#a8efcf',
          300: '#6ee1b3',
          400: '#32cc91',
          500: '#0eb078',
          600: '#048f61',
          700: '#037250',
          800: '#065b41',
          900: '#064b37',
        },
        ink: {
          50: '#f6f6f7',
          100: '#e1e2e6',
          200: '#c3c4cd',
          300: '#9d9eac',
          400: '#787a8b',
          500: '#5e6071',
          600: '#494b5a',
          700: '#3d3e4c',
          800: '#282934',
          900: '#121217',
        },
        accent: {
          50: '#fff8eb',
          100: '#ffedc6',
          200: '#ffd888',
          300: '#ffbe4a',
          400: '#ffa721',
          500: '#f98408',
          600: '#dd6003',
          700: '#b74207',
          800: '#94320d',
          900: '#7a2a0e',
        },
        glass: {
          light: 'rgba(255,255,255,0.6)',
          medium: 'rgba(255,255,255,0.3)',
          heavy: 'rgba(255,255,255,0.15)',
          border: 'rgba(255,255,255,0.3)',
        },
      },
      fontFamily: {
        // Noto Serif SC (book-style, CJK-only on Google Fonts) is listed
        // FIRST so Chinese characters automatically render in serif. The
        // browser falls through to Noto Sans SC for Latin because the
        // Noto Serif SC subset only contains CJK code points.
        sans: ['"Noto Serif SC"', '"Noto Sans SC"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif SC"', '"Noto Sans SC"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'flip': 'flip 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out 2s infinite',
        'float-slow': 'float 10s ease-in-out 4s infinite',
        'morph': 'morph 8s ease-in-out infinite',
        'morph-delayed': 'morph 12s ease-in-out 3s infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'liquid-ripple': 'liquidRipple 2s ease-out forwards',
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        morph: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '25%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
          '50%': { borderRadius: '50% 50% 30% 70% / 40% 60% 50% 50%' },
          '75%': { borderRadius: '40% 60% 40% 60% / 60% 40% 60% 40%' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139,92,246,0.3), 0 0 60px rgba(139,92,246,0.1)' },
          '50%': { boxShadow: '0 0 35px rgba(139,92,246,0.5), 0 0 80px rgba(139,92,246,0.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        liquidRipple: {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}