import fs from 'fs/promises';
import path from 'path';
import express, { NextFunction, Request, Response, Router } from 'express';
import { fileURLToPath, pathToFileURL } from 'url';
import { authLimiter, globalLimiter, messagesLimiter, syncLimiter } from './middleware/rateLimit.js';

const injectRouters = async (dir: string, app: express.Application) => {
  const items = await fs.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      await injectRouters(fullPath, app);
    } else if (item.endsWith('.js') || item.endsWith('.ts')) {
      try {
        const module = await import(pathToFileURL(fullPath).href);
        const router: Router = module.default || module;

        if (router && typeof router === 'function' && 'stack' in router) {
          app.use(router);
          // console.log(`✅ Loaded router from ${fullPath}`);
        } else {
          console.warn(`⚠️  Skipped non-router file: ${fullPath}`);
        }
      } catch (err) {
        console.error(`❌ Failed to import router ${fullPath}:`, err);
      }
    }
  }
  return app;
};

export const printRoutes = (stack: any[], prefix = '') => {
  stack.forEach(layer => {
    if (layer.route) {
      const route = layer.route as any;
      const methods = Object.keys(route.methods || {}).map(m => m.toUpperCase()).join(',');
      console.log(`${methods} ${prefix}${route.path}`);
    } else if (layer.name === 'router' && layer.handle?.stack) {
      printRoutes(layer.handle.stack, prefix); // keep prefix as root
    }
  });
};

/**
 * Device sync posts batches of logs; everything else is a short JSON object.
 * One global parser with two caps, chosen by path.
 */
const bodyParsers = () => {
  const sync = express.json({ limit: process.env.JIKO_SYNC_BODY_LIMIT || '2mb' });
  const normal = express.json({ limit: process.env.JIKO_BODY_LIMIT || '128kb' });
  return (req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/sync/') ? sync(req, res, next) : normal(req, res, next);
};

/** Turn body-parser failures into the same error shape as everything else. */
const bodyErrors = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'PayloadTooLarge', message: 'Request body is too large.' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'InvalidBody', message: 'Body is not valid JSON.' });
  }
  return next(err);
};

const createApp = async () => {
  const app = express();
  // Behind a load balancer the client IP is in X-Forwarded-For; trust one hop.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

  app.use(bodyParsers());
  app.use(bodyErrors);

  app.use('/sync', syncLimiter);
  app.use('/messages', messagesLimiter);
  app.use(['/auth/login', '/auth/signup', '/auth/request-otp', '/auth/refresh'], authLimiter);
  app.use(globalLimiter);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const routesDir = path.join(__dirname, 'routes');
  const injectedApp = await injectRouters(routesDir, app);
  // printRoutes(app.router.stack);

  return injectedApp
};

export default createApp;
