import fs from 'fs';
import path from 'path';
import express from 'express';

const app = express();
app.use(express.json());

const loadRouters = (dir: string) => {
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recurse into subdirectories
      loadRouters(fullPath);
    } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.ts'))) {
      // Dynamically import the router module
      const routerModule = require(fullPath); // or `await import(fullPath)` for ESM
      const router = routerModule.default || routerModule;

      if (router && typeof router === 'function' && 'stack' in router) {
        // It's an Express router, just mount it at root ('/')
        app.use(router);
        console.log(`Loaded router from ${fullPath}`);
      }
    }
  });
};


// 👇 wrap in async IIFE so it works in both ESM + CommonJS
(async () => {
  try {
    await loadRouters(path.join(__dirname, 'routes'));
  } catch (err) {
    console.error('Failed to register routes:', err);
  }
})();

export default app;