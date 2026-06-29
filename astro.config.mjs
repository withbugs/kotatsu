import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://withbugs.github.io',
  base: '/kotatsu',
  output: 'static',
  trailingSlash: 'always',
  integrations: [mdx()]
});


