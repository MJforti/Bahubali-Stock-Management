import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/** Writes dist/sw.js with every built file precached, so the app runs fully offline. */
function offlineServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'offline-service-worker',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push('/' + relative(outDir, full).split('\\').join('/'));
        }
      };
      walk(outDir);
      const urls = files.filter((f) => f !== '/sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      urls.forEach((u) => hash.update(u).update(readFileSync(join(outDir, u))));
      const sw = readFileSync('pwa/sw-template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE_URLS__', JSON.stringify(urls, null, 2));
      writeFileSync(join(outDir, 'sw.js'), sw);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('xlsx')) return 'vendor-excel';
            return 'vendor';
          }
        }
      }
    }
  }
});
