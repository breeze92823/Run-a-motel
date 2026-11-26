import { defineConfig, loadEnv } from 'vite'

// Boxity's local platform (docs.bloxity.io > Environments > Local development): a standalone dev
// page tells the SDK it runs against the local portal / API / game server. Injected by the dev
// server only (apply: 'serve'), never into a production build, and only when BLOXITY_LOCAL=true
// (in .env or the shell), so a plain `npm run dev` keeps using prod like any untold page.
const LOCAL_ENV = { env: 'local', apiUrl: 'http://localhost:4000', playUrl: 'http://localhost:2567', portalUrl: 'http://localhost:3000', staticUrl: 'https://static.bloxity.io' }

export default defineConfig(({ mode }) => {
  const local = (process.env.BLOXITY_LOCAL ?? loadEnv(mode, process.cwd(), '').BLOXITY_LOCAL) === 'true'
  return {
    // Relative asset paths so the zipped dist/ runs from any Bloxity host path.
    base: './',
    // es2022 for top-level await in main.js (Rapier's wasm init).
    build: { target: 'es2022', chunkSizeWarningLimit: 4000 }, // rapier3d-compat inlines its wasm
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
    plugins: [
      {
        name: 'boxity-local-env',
        apply: 'serve',
        transformIndexHtml: () => (local ? [{ tag: 'script', children: `window.BLOXITY_ENV = ${JSON.stringify(LOCAL_ENV)}`, injectTo: 'head-prepend' }] : []),
      },
    ],
  }
})
