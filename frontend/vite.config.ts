import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Writes every built file into the service worker's BUILD_ASSETS, so it
 * caches every screen up front (public/sw.js) and each build gets a new
 * worker.
 */
function precacheBuild(): Plugin {
  let assets: string[] = []
  let outDir = "dist"
  return {
    name: "precache-build",
    apply: "build",
    generateBundle(options, bundle) {
      outDir = options.dir ?? outDir
      assets = Object.keys(bundle)
        .filter((file) => file.startsWith("assets/"))
        .sort()
        .map((file) => `/${file}`)
    },
    closeBundle() {
      const path = resolve(outDir, "sw.js")
      const worker = readFileSync(path, "utf8")
      const marker = "const BUILD_ASSETS = []"
      if (!worker.includes(marker))
        throw new Error("public/sw.js has no BUILD_ASSETS to fill in")
      writeFileSync(
        path,
        worker.replace(marker, `const BUILD_ASSETS = ${JSON.stringify(assets)}`)
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), precacheBuild()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    // Tablets on the same Wi-Fi open http://<this-machine>:3000.
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
      // The connectivity probe, which answers without signing in.
      "/health": "http://127.0.0.1:8000",
    },
  },
  // `bun run preview` serves the production build (with the service worker) against the same local API.
  preview: {
    port: 3001,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
      "/health": "http://127.0.0.1:8000",
    },
  },
})
