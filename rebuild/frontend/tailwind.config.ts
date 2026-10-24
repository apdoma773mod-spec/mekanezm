import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Cairo', 'system-ui', 'sans-serif'] },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        muted: v('muted'),
        border: v('border'),
        fg: v('fg'),
        subtle: v('subtle'),
        primary: v('primary'),
        'on-primary': v('on-primary'),
        danger: v('danger'),
        success: v('success'),
        warning: v('warning'),
      },
      borderRadius: { xl: '0.875rem' },
    },
  },
  plugins: [],
} satisfies Config;
