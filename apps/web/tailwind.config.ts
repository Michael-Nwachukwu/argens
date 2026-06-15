import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#0C0B0A',
        bg2:      '#131210',
        bg3:      '#1C1916',
        border:   '#252220',
        border2:  '#34302B',
        text:     '#EDE9E3',
        text2:    '#B0A99F',
        muted:    '#706B65',
        faint:    '#403C38',
        accent:   '#C5A253',
        success:  '#4D9B6A',
        warning:  '#B8832A',
        error:    '#A04848',
        pending:  '#6B7FAF',
      },
      fontFamily: {
        head: ['DM Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
        xl: '12px',
      },
    },
  },
  plugins: [],
}

export default config
