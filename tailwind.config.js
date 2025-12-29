/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-searchmind': 'var(--color-primary-searchmind)',
        'primary-searchmind-lighter': 'var(--color-primary-searchmind-lighter)',
        'primary-searchmind-hover': 'var(--color-primary-searchmind-hover)',
        'secondary-searchmind': 'var(--color-secondary-searchmind)',
        'secondary-searchmind-hover': 'var(--color-secondary-searchmind-hover)',
        'dark-green': 'var(--color-dark-green)',
        'lime': 'var(--color-lime)',
        'natural': 'var(--color-natural)',
        'light-natural': 'var(--color-light-natural)',
        'dark-natural': 'var(--color-dark-natural)',
        'light-green': 'var(--color-light-green)',
        'green': 'var(--color-green)',
        'black': 'var(--color-black)',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
