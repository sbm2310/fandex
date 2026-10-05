import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Serves the exported Expo web app (a single-page app) from the API's own origin, so the web
 * session cookie is first-party (browsers increasingly block third-party cookies).
 * - Content-hashed bundles under /_expo/static are cached for a year; everything else
 *   (index.html in particular) is revalidated, so a deploy shows up immediately.
 * - Any other GET outside /api returns index.html; the app's router handles the path.
 */
export function serveWebApp(app: NestExpressApplication, webAppDir: string): void {
  // Absolute, because Express's sendFile requires it (render.yaml passes a relative path).
  const directory = resolve(webAppDir);
  const indexHtml = join(directory, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(`WEB_APP_DIR has no index.html: ${directory}`);
  }

  app.useStaticAssets(directory, {
    index: false,
    setHeaders: (response, path) => {
      response.setHeader(
        'Cache-Control',
        path.includes('/_expo/static/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });

  app.use(
    (
      request: { method: string; path: string },
      response: { setHeader(name: string, value: string): void; sendFile(path: string): void },
      next: () => void,
    ) => {
      if (request.method !== 'GET' || request.path === '/api' || request.path.startsWith('/api/')) {
        return next();
      }
      response.setHeader('Cache-Control', 'no-cache');
      response.sendFile(indexHtml);
    },
  );
}
