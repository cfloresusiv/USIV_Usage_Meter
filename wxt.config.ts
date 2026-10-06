import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  // El zip de fuentes para AMO no debe incluir archivos locales ajenos al proyecto.
  zip: { excludeSources: ['CLAUDE_METER_EXTENSION_CHROME.md', '*.py', '.claude/**'] },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    short_name: 'USIV Meter',
    description: '__MSG_extDescription__',
    default_locale: 'es',
    homepage_url: 'https://usiv.cl',
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://claude.ai/*'],
    action: { default_title: '__MSG_extName__' },
    // Solo el logo, para mostrarlo dentro del panel en claude.ai.
    web_accessible_resources: [{ resources: ['icon/48.png', 'icon/32.png'], matches: ['https://claude.ai/*'] }],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'usage-meter@usiv.cl',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
});
