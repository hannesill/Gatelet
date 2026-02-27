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
      favicon: '/favicon.svg',
      customCss: ['./src/styles/starlight.css'],
      components: {
        Header: './src/components/DocsHeader.astro',
      },
      head: [
        {
          tag: 'script',
          content: `(function(){var t=localStorage.getItem('theme');if(t)localStorage.setItem('starlight-theme',t);var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)})();`,
        },
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
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
        styleOverrides: {
          borderRadius: '0.75rem',
          borderColor: 'var(--sl-color-hairline)',
          codeFontFamily: '"JetBrains Mono", ui-monospace, monospace',
          codeFontSize: '0.8125rem',
          codeLineHeight: '1.7',
          codePaddingBlock: '1rem',
          codePaddingInline: '1.25rem',
          frames: {
            editorTabBarBorderBottomColor: 'var(--sl-color-hairline)',
          },
        },
      },
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
            { label: 'Content Filters & Guards', slug: 'concepts/content-filters' },
          ],
        },
        {
          label: 'Providers',
          items: [
            { label: 'Google Calendar', slug: 'providers/google-calendar' },
            { label: 'Outlook Calendar', slug: 'providers/outlook-calendar' },
            { label: 'Gmail', slug: 'providers/gmail' },
            { label: 'Outlook Mail', slug: 'providers/outlook-mail' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Native Host', slug: 'deployment/native-host' },
            { label: 'Docker', slug: 'deployment/docker' },
            { label: 'Configuration', slug: 'deployment/configuration' },
            { label: 'Custom OAuth Apps', slug: 'deployment/custom-oauth-apps' },
            { label: 'Updating', slug: 'deployment/updating' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Security Model', slug: 'reference/security' },
            { label: 'Agent Setup', slug: 'reference/agents' },
            { label: 'OpenClaw Setup', slug: 'reference/openclaw-setup' },
            { label: 'CLI', slug: 'reference/cli' },
            { label: 'Architecture', slug: 'reference/architecture' },
            { label: 'Creating a Provider', slug: 'reference/creating-a-provider' },
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
