import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          450: '#5B54EA',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      spacing: {
        safe: 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'gradient-green':   'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
        'gradient-amber':   'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
      },
      boxShadow: {
        'indigo-glow': '0 0 20px rgba(99,102,241,0.35)',
        'green-glow':  '0 0 20px rgba(16,185,129,0.35)',
        'card': '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'card-dark': '0 2px 16px rgba(0,0,0,0.30)',
      },
    },
  },
  plugins: [],
};

export default config;
