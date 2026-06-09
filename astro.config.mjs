// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// Modo estatico por defecto -> Vercel detecta Astro y despliega dist/ sin adapter.
// Si en el futuro se requiere SSR o ISR, anadir @astrojs/vercel y output: 'server'.
export default defineConfig({
  site: 'https://revista-ingenieria-2026.vercel.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
  },
  image: {
    // Sharp es el servicio por defecto en Astro 5
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    mdx(),
    react({ include: ['**/islands/**'] }),
  ],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // page-flip toca window en init; evitamos que Astro intente SSR-izarlo
      noExternal: ['page-flip'],
    },
  },
  experimental: {
    clientPrerender: true,
  },
});
