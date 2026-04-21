import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // CSS-var tokens (for className use)
        background: 'var(--background)',
        foreground: 'var(--foreground)',

        // Midnight Indigo palette
        navy: {
          950: '#030d1e',
          900: '#071426',
          800: '#0c1d38',
          700: '#122547',
        },
        indigo: {
          DEFAULT: '#6366f1',
          400: '#818cf8',
          300: '#a5b4fc',
          200: '#c7d2fe',
          glow: 'rgba(99,102,241,0.25)',
        },
        cyan: {
          DEFAULT: '#22d3ee',
          400: '#38bdf8',
          glow: 'rgba(34,211,238,0.2)',
        },
        gold: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          glow: 'rgba(245,158,11,0.3)',
        },
        // Semantic
        emerald: { DEFAULT: '#10b981', 400: '#34d399' },
        violet:  { DEFAULT: '#8b5cf6', 400: '#a78bfa' },
        // Legacy compat
        primary:     { DEFAULT: 'hsl(222.2, 47.4%, 11.2%)', foreground: 'hsl(210, 40%, 98%)' },
        secondary:   { DEFAULT: 'hsl(210, 40%, 96.1%)',     foreground: 'hsl(222.2, 47.4%, 11.2%)' },
        muted:       { DEFAULT: 'hsl(210, 40%, 96.1%)',     foreground: 'hsl(215.4, 16.3%, 46.9%)' },
        destructive: { DEFAULT: 'hsl(0, 84.2%, 60.2%)',     foreground: 'hsl(210, 40%, 98%)' },
        border: 'hsl(214.3, 31.8%, 91.4%)',
      },
      borderRadius: {
        sm: '0.375rem', md: '0.5rem', lg: '0.75rem',
        xl: '1rem', '2xl': '1.25rem', '3xl': '1.5rem',
      },
      backgroundImage: {
        'gradient-radial':  'radial-gradient(var(--tw-gradient-stops))',
        'gradient-indigo':  'linear-gradient(135deg, #6366f1, #22d3ee)',
        'gradient-gold':    'linear-gradient(135deg, #f59e0b, #f97316)',
        'gradient-emerald': 'linear-gradient(135deg, #10b981, #22d3ee)',
        'gradient-violet':  'linear-gradient(135deg, #8b5cf6, #ec4899)',
      },
      boxShadow: {
        'card':    '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        'indigo':  '0 0 32px rgba(99,102,241,0.25)',
        'gold':    '0 0 32px rgba(245,158,11,0.3)',
        'emerald': '0 0 32px rgba(16,185,129,0.2)',
        'cyan':    '0 0 32px rgba(34,211,238,0.2)',
      },
      animation: {
        'float': 'float 3.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.22,1,0.36,1)',
      },
      keyframes: {
        float:      { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        pulseGlow:  { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        slideInRight: { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
