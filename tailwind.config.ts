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
        ink: '#17243a',
        mist: '#f4f6f8',
        ocean: '#286f73',
        sun: '#e9a23b',
      },
    },
  },
  plugins: [],
}

export default config
