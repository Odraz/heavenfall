/** Optional Windows D3D11 run: the same suites, viewports, deadlines and limits as the default. */
import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, use: { ...config.use, launchOptions: { args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] } } });
