import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E293B',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#CE8FB0',
          foreground: '#1E293B',
        },
        dark: {
          DEFAULT: '#0F172A',
          foreground: '#F4F4F6',
        },
        cream: '#D0C3AB',
        bg: {
          DEFAULT: '#F4F4F6',
          soft: '#ECECF0',
          cream: '#D0C3AB',
        },
        lavender: {
          DEFAULT: '#E8E6EF',
          light: '#FAF9FC',
          soft: '#B4B1D8',
        },
        accent: {
          DEFAULT: '#B4B1D8',
          hover: '#9E9AC8',
        },
        plum: '#856B92',
        rose: '#CE8FB0',
        periwinkle: '#B4B1D8',
        sand: '#D0C3AB',
        'text-muted': '#64748B',
        'text-soft': '#94A3B8',
        surface: '#ffffff',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-sm': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        display: ['clamp(2.25rem,5vw,3.25rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        glow: {
          '0%': { opacity: '0.6' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(135deg, #F4F4F6 0%, #D0C3AB 45%, #ECECF0 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
