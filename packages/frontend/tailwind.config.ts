import type { Config } from 'tailwindcss';

// kp-* renkleri hex CSS degiskeni; Tailwind 3 bunlara /<alfa> uygulayamaz ve sinifi sessizce
// uretmez (P9 bulgusu: bg-kp-accent/90 soluk cikti). Renk fonksiyonu opacityValue alir ve
// color-mix ile karistirir (globals.css zaten color-mix kullaniyor). 437 kullanim tek yerden duzeldi.
const kp = (v: string) => ({ opacityValue }: { opacityValue?: string }) =>
  opacityValue === undefined || opacityValue === '1'
    ? `var(${v})`
    : `color-mix(in srgb, var(${v}) calc(${opacityValue} * 100%), transparent)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background
        'kp-bg-primary': kp('--bg-primary'),
        'kp-bg-secondary': kp('--bg-secondary'),
        'kp-bg-tertiary': kp('--bg-tertiary'),
        'kp-bg-hover': kp('--bg-hover'),
        'kp-bg-active': kp('--bg-active'),
        // Border
        'kp-border': kp('--border-default'),
        'kp-border-subtle': kp('--border-subtle'),
        'kp-border-accent': kp('--border-accent'),
        // Text
        'kp-text-primary': kp('--text-primary'),
        'kp-text-secondary': kp('--text-secondary'),
        'kp-text-tertiary': kp('--text-tertiary'),
        // Accent
        'kp-accent': kp('--accent'),
        'kp-accent-hover': kp('--accent-hover'),
        'kp-accent-muted': kp('--accent-muted'),
        // Semantic
        'kp-success': kp('--success'),
        'kp-success-muted': kp('--success-muted'),
        'kp-warning': kp('--warning'),
        'kp-warning-muted': kp('--warning-muted'),
        'kp-danger': kp('--danger'),
        'kp-danger-muted': kp('--danger-muted'),
        'kp-info': kp('--info'),
        'kp-info-muted': kp('--info-muted'),
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'kp-sm': kp('--radius-sm'),
        'kp-md': kp('--radius-md'),
        'kp-lg': kp('--radius-lg'),
        'kp-xl': kp('--radius-xl'),
      },
      boxShadow: {
        'kp-card': kp('--shadow-card'),
        'kp-elevated': kp('--shadow-elevated'),
        'kp-dropdown': kp('--shadow-dropdown'),
        'kp-glow': kp('--shadow-glow-accent'),
      },
      spacing: {
        'sidebar': 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed)',
        'header': 'var(--header-height)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-in-up': 'fadeInUp 300ms ease-out',
        'slide-in-left': 'slideInLeft 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
