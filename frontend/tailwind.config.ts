import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // New color scheme from provided palette
        palette: {
          yellow: '#FBDB04',        // School bus Yellow
          dark: '#2B271E',          // Zeus (dark gray/black)
          white: '#F6F6EA',         // Ecru White
          orange: '#D03E16',        // Thunderbird (orange-red)
        },
        // UNSW brand colors from RegistrationView.swift (keeping as backup)
        unsw: {
          yellow: '#ffd600',              // Color(red: 1.0, green: 0.84, blue: 0.0) - using hex for better compatibility
          'dark-blue': '#003366',         // Color(red: 0.0, green: 0.2, blue: 0.4)
          navy: '#002244',               // Darker navy for text
        },
      },
    },
  },
  plugins: [],
} satisfies Config