import type { Config } from 'tailwindcss';

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
        'kp-bg-primary': 'var(--bg-primary)',
        'kp-bg-secondary': 'var(--bg-secondary)',
        'kp-bg-tertiary': 'var(--bg-tertiary)',
        'kp-bg-hover': 'var(--bg-hover)',
        'kp-bg-active': 'var(--bg-active)',
        // Border
        'kp-border': 'var(--border-default)',
        'kp-border-subtle': 'var(--border-subtle)',
        'kp-border-accent': 'var(--border-accent)',
        // Text
        'kp-text-primary': 'var(--text-primary)',
        'kp-text-secondary': 'var(--text-secondary)',
        'kp-text-tertiary': 'var(--text-tertiary)',
        // Accent
        'kp-accent': 'var(--accent)',
        'kp-accent-hover': 'var(--accent-hover)',
        'kp-accent-muted': 'var(--accent-muted)',
        // Semantic
        'kp-success': 'var(--success)',
        'kp-success-muted': 'var(--success-muted)',
        'kp-warning': 'var(--warning)',
        'kp-warning-muted': 'var(--warning-muted)',
        'kp-danger': 'var(--danger)',
        'kp-danger-muted': 'var(--danger-muted)',
        'kp-info': 'var(--info)',
        'kp-info-muted': 'var(--info-muted)',
      },
      fontFamily: {
        outfit: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'kp-sm': 'var(--radius-sm)',
        'kp-md': 'var(--radius-md)',
        'kp-lg': 'var(--radius-lg)',
        'kp-xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'kp-card': 'var(--shadow-card)',
        'kp-elevated': 'var(--shadow-elevated)',
        'kp-dropdown': 'var(--shadow-dropdown)',
        'kp-glow': 'var(--shadow-glow-accent)',
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
