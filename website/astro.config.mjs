import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://gatelet.dev',
  integrations: [
    react(),
    starlight({
      title: 'Gatelet',
      customCss: ['./src/styles/app.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/intro/' },
            { label: 'Installation', link: '/installation/' },
          ],
        },
      ],
    })
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      preserveSymlinks: true,
    }
  }
});
