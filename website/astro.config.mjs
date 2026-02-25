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
      customCss: ['./src/styles/starlight.css'],
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.googleapis.com',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: true,
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
          },
        },
      ],
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/hannesill/gatelet' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'First Setup', slug: 'getting-started/first-setup' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Policies', slug: 'concepts/policies' },
            { label: 'Constraints', slug: 'concepts/constraints' },
            { label: 'Mutations', slug: 'concepts/mutations' },
            { label: 'Field Policies', slug: 'concepts/field-policies' },
            { label: 'Content Filters', slug: 'concepts/content-filters' },
          ],
        },
        {
          label: 'Providers',
          items: [
            { label: 'Google Calendar', slug: 'providers/google-calendar' },
            { label: 'Outlook Calendar', slug: 'providers/outlook-calendar' },
            { label: 'Gmail', slug: 'providers/gmail' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Docker', slug: 'deployment/docker' },
            { label: 'Configuration', slug: 'deployment/configuration' },
            { label: 'Updating', slug: 'deployment/updating' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Security Model', slug: 'reference/security' },
            { label: 'Agent Setup', slug: 'reference/agents' },
            { label: 'CLI', slug: 'reference/cli' },
            { label: 'Architecture', slug: 'reference/architecture' },
            { label: 'Development', slug: 'reference/development' },
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
