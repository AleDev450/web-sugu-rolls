import type { Config } from 'tailwindcss';

/**
 * Identidad de Sugu Rolls.
 * Los colores salen del logotipo: negro profundo, rojo intenso y crema.
 * El rojo se reserva para llamadas a la acción, precios y acentos.
 */
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          DEFAULT: '#050505',
          soft: '#0C0C0C',
          2: '#141414',
          3: '#1C1C1C',
        },
        sugu: {
          DEFAULT: '#E31323',
          deep: '#920B15',
          glow: '#FF2E3D',
        },
        bone: {
          DEFAULT: '#FFFFFF',
          soft: '#F3F0EA',
          dim: '#B8B8B8',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        brush: ['var(--font-brush)', 'cursive'],
      },
      letterSpacing: {
        kicker: '0.42em',
      },
      maxWidth: {
        wrap: '1440px',
        prose: '58ch',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 38s linear infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
