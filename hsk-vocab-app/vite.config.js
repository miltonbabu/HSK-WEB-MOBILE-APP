import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': '/src',
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/api/deepseek': {
                target: 'https://api.deepseek.com',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api\/deepseek/, ''); },
            },
        },
    },
});
