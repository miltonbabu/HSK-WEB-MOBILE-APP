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
            // Match every Vercel-style /api/* route used in this app so dev mode
            // mirrors prod (previously only /api/ai was proxied, which meant
            // /api/guest/identity always fell back to a local-only UUID in dev).
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    optimizeDeps: {
        exclude: ['@mlc-ai/web-llm'],
    },
    build: {
        chunkSizeWarningLimit: 5000,
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes('@mlc-ai/web-llm'))
                        return 'webllm';
                    return undefined;
                },
            },
        },
    },
});
