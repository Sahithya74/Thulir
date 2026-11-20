import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const browserShim = (f: string) => here(`../server/src/browser/${f}`)

/**
 * `vite build --mode pages` makes the static GitHub Pages build: served under /Thulir/, with the real Thulir API
 * running inside the browser tab (server/src/browser/staticApi.ts) instead of on a server. The aliases below swap
 * the few Node-only imports the server modules use for small browser stand-ins; they only affect server code.
 */
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages'
  return {
    base: pages ? '/Thulir/' : '/',
    plugins: [react(), tailwindcss()],
    define: { 'import.meta.env.VITE_STATIC_API': JSON.stringify(pages ? '1' : '0') },
    resolve: {
      alias: [
        { find: '@', replacement: here('./src') },
        { find: '@thulir/shared', replacement: here('../shared/src/index.ts') },
        { find: 'virtual:thulir-static-api', replacement: browserShim('staticApi.ts') },
        { find: /^express$/, replacement: browserShim('express.ts') },
        { find: /^jsonwebtoken$/, replacement: browserShim('jwt.ts') },
        { find: /^(node:)?crypto$/, replacement: browserShim('crypto.ts') },
        { find: /^node:(fs\/promises|path)$/, replacement: browserShim('nodeStubs.ts') },
      ],
    },
    server: {
      port: 5180,
      proxy: { '/api': 'http://localhost:4000', '/uploads': 'http://localhost:4000' },
    },
    test: {
      include: ['src/**/*.test.ts', '../shared/src/**/*.test.ts'],
      environment: 'node',
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three/')) return 'three'
            if (id.includes('@react-three')) return 'r3f'
            return undefined
          },
        },
      },
    },
  }
})
