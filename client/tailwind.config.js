/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Design tokens ──────────────────────────────────────────────────────
      colors: {
        // Primary brand — deep indigo
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',  // primary
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Accent — emerald for success/won states
        success: {
          100: '#dcfce7',
          500: '#22c55e',
          700: '#15803d',
        },
        // Danger — red for lost/error
        danger: {
          100: '#fee2e2',
          500: '#ef4444',
          700: '#b91c1c',
        },
        // Warning — amber for overdue/pending
        warning: {
          100: '#fef9c3',
          500: '#eab308',
          700: '#a16207',
        },
        // Neutral surface shades (dark mode first)
        surface: {
          900: '#0f0f13',
          800: '#18181f',
          700: '#23232e',
          600: '#2e2e3d',
          500: '#3d3d52',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'glow-brand': '0 0 20px rgba(99, 102, 241, 0.35)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
