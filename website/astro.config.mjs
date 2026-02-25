import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Gatelet',
      logo: {
        src: '../assets/logo.svg',
      },
			social: {
				github: 'https://github.com/hannesill/gatelet',
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is a convention; files should exist in src/content/docs/
						{ label: 'Introduction', link: '/guides/introduction/' },
						{ label: 'Installation', link: '/guides/installation/' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
      customCss: [
        './src/styles/custom.css',
      ],
		}),
		react(),
	],
  // This is required for GitHub Pages
  site: 'https://gatelet.dev',
});
