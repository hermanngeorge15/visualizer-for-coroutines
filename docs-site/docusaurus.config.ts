import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

const config: Config = {
  title: 'Kotlin Coroutine Visualizer',
  tagline: 'Real-time visualization of Kotlin coroutine execution',
  url: 'https://hermanngeorge15.github.io',
  baseUrl: '/visualizer-for-coroutines/',
  organizationName: 'hermanngeorge15',
  projectName: 'visualizer-for-coroutines',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    ['classic', {
      docs: { sidebarPath: './sidebars.ts', routeBasePath: '/' },
      blog: false,
      theme: { customCss: './src/css/custom.css' }
    } satisfies Preset.Options]
  ],
  themeConfig: {
    navbar: {
      title: 'Coroutine Visualizer',
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        { href: 'https://github.com/hermanngeorge15/visualizer-for-coroutines', label: 'GitHub', position: 'right' }
      ]
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} Kotlin Coroutine Visualizer`
    }
  } satisfies Preset.ThemeConfig
}
export default config
