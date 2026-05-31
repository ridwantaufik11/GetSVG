import { defineConfig, build as viteBuild } from 'vite'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, mkdirSync, writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function chromeExtension() {
  return {
    name: 'chrome-extension',
    apply: 'build' as const,
    enforce: 'post' as const,
    async closeBundle() {
      // Background service worker (ESM module)
      await viteBuild({
        configFile: false,
        logLevel: 'warn',
        build: {
          lib: {
            entry: resolve(__dirname, 'src/background/index.ts'),
            formats: ['es'],
            fileName: () => 'background.js',
          },
          outDir: resolve(__dirname, 'dist'),
          emptyOutDir: false,
          minify: true,
        },
      })

      // Content script as self-contained IIFE — no dynamic imports, Chrome injects directly
      await viteBuild({
        configFile: false,
        logLevel: 'warn',
        build: {
          lib: {
            entry: resolve(__dirname, 'src/content/index.ts'),
            name: '__svgr',
            formats: ['iife'],
            fileName: () => 'content.js',
          },
          outDir: resolve(__dirname, 'dist'),
          emptyOutDir: false,
          minify: true,
        },
      })

      // Copy icons
      mkdirSync(resolve(__dirname, 'dist/icons'), { recursive: true })
      for (const size of [16, 48, 128]) {
        copyFileSync(
          resolve(__dirname, `icons/icon${size}.png`),
          resolve(__dirname, `dist/icons/icon${size}.png`)
        )
      }

      // Write manifest with correct output paths
      writeFileSync(
        resolve(__dirname, 'dist/manifest.json'),
        JSON.stringify(
          {
            manifest_version: 3,
            name: 'GetSVG - SVG Grabber & Downloader',
            version: '1.0.0',
            description: 'Right-click any SVG to copy or download it instantly. Highlights all SVGs on the page at once.',
            permissions: ['activeTab', 'contextMenus', 'downloads', 'scripting', 'storage'],
            host_permissions: ['<all_urls>'],
            background: { service_worker: 'background.js', type: 'module' },
            content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'] }],
            action: {
              default_popup: 'src/popup/index.html',
              default_icon: 'icons/icon48.png',
            },
            icons: {
              '16': 'icons/icon16.png',
              '48': 'icons/icon48.png',
              '128': 'icons/icon128.png',
            },
          },
          null,
          2
        )
      )
    },
  }
}

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: resolve(__dirname, 'src/popup/index.html') },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [chromeExtension()],
})
