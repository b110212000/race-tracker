import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = process.env.GITHUB_PAGES_REPO?.trim();
// 專案頁面 /owner/repo/；自訂網域或本機則使用 /
const base = repo ? `/${repo}/` : '/';

export default defineConfig({ plugins: [react()], base });
