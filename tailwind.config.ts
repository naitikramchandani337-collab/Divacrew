import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F5EFE8',
        surface: '#FAF5F0',
        charcoal: '#1A1A1A',
        blush: '#F9E8E3',
        terracotta: '#B94A3C',
        'terracotta-light': '#E8A090',
        forest: '#2D5A45',
        'text-secondary': '#6B5F58',
        border: '#E8DDD6',
      },
      fontFamily: {
        serif: ['Playfair Display', 'DM Serif Display', 'Georgia', 'serif'],
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        'card-lg': '24px',
        pill: '50px',
      },
    },
  },
  plugins: [],
};

export default config;
