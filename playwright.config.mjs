import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.mjs',
  timeout: 15000,
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:4173', headless: true},
  webServer: {command: 'npm start', port: 4173, reuseExistingServer: true}
});
