import {defineConfig} from '@playwright/test';

const port = Number(process.env.TELLTALES_TEST_PORT ?? 4173);

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.mjs',
  timeout: 15000,
  use: {baseURL: `http://127.0.0.1:${port}`, headless: true},
  webServer: {command: 'npm start', port, reuseExistingServer: true}
});
