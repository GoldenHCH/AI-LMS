import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        panel: '0 18px 50px -28px rgba(20, 37, 63, 0.3)',
      },
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        mist: 'rgb(var(--color-mist) / <alpha-value>)',
        ocean: 'rgb(var(--color-ocean) / <alpha-value>)',
        sun: 'rgb(var(--color-sun) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}

export default config
