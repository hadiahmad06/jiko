import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = 3000;

app.use(express.json());

const routesPath = path.join(__dirname, 'routes');

// recursive function to find all router files
function registerRoutes(dir: string, baseRoute = '') {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      registerRoutes(fullPath, `${baseRoute}/${file}`);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.ts'))) {
      const route = require(fullPath).default;
      if (route && route.stack) { // make sure it’s an express router
        let routePath = baseRoute;
        if (file !== 'index.js' && file !== 'index.ts') {
          routePath += `/${file.replace(/\.(js|ts)$/, '')}`;
        }
        app.use(routePath, route);
        console.log(`Registered route: ${routePath}`);
      }
    }
  });
}

registerRoutes(routesPath);

export default app;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
