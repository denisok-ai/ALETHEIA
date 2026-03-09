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
          DEFAULT: '#2D1B4E',
          foreground: '#fffefb',
        },
        secondary: {
          DEFAULT: '#D4AF37',
          foreground: '#0A0E27',
        },
        dark: {
          DEFAULT: '#0A0E27',
          foreground: '#f5f0e8',
        },
        cream: '#f5f0e8',
        bg: {
          DEFAULT: '#fffefb',
          soft: '#faf8f5',
          cream: '#f5f2ec',
        },
        lavender: {
          DEFAULT: '#E5DAED',
          light: '#f0eaf4',
          soft: '#d4c4e0',
        },
        accent: {
          DEFAULT: '#D4AF37',
          hover: '#b8942a',
        },
        'text-muted': '#5c5854',
        'text-soft': '#8a8580',
        surface: '#ffffff',
      },
      fontFamily: {
        heading: ['var(--font-literata)', 'Georgia', 'serif'],
        body: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
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
        'gradient-mesh': 'linear-gradient(135deg, #fffefb 0%, #f5f2ec 50%, #faf8f5 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
