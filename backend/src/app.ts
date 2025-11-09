import fs from 'fs/promises';
import path from 'path';
import express, { Router } from 'express';
import { fileURLToPath, pathToFileURL } from 'url';
import control from './routes/activities.js';

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

const printRoutes = (stack: any[], prefix = '') => {
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

const createApp = async () => {
  const app = express();
  app.use(express.json());
  app.use('/', control)


  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const routesDir = path.join(__dirname, 'routes');
  const injectedApp = await injectRouters(routesDir, app);
  // printRoutes(app.router.stack);

  return injectedApp
};

export default createApp;
