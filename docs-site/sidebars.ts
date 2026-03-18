import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'
const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    { type: 'category', label: 'Getting Started', items: ['getting-started/installation', 'getting-started/quick-start', 'getting-started/docker'] },
    { type: 'category', label: 'Web Guide', items: ['web-guide/sessions', 'web-guide/scenarios', 'web-guide/visualization', 'web-guide/validation'] },
    { type: 'category', label: 'Plugin Guide', items: ['plugin-guide/installation', 'plugin-guide/usage', 'plugin-guide/settings'] },
    { type: 'category', label: 'API Reference', items: ['api/events', 'api/wrappers', 'api/validation-rules'] },
    { type: 'category', label: 'Advanced', items: ['advanced/architecture', 'advanced/custom-scenarios', 'advanced/extending-validation'] }
  ]
}
export default sidebars
