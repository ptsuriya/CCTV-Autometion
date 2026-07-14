/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: '#070817',
        panel: '#10152b',
        primary: '#4338ca',
        accent: '#7c3aed',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(129, 140, 248, .15), 0 18px 60px rgba(7, 8, 23, .32)',
      },
    },
  },
  plugins: [],
};
