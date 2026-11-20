/** The in-browser Thulir API used by the static GitHub Pages build (aliased in vite.config.ts). */
declare module 'virtual:thulir-static-api' {
  export function installStaticApi(): Promise<void>
}
