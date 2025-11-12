import { Router } from 'express';

const router = Router();

// GET /health - get server health info
router.get('/health', (req, res) => {
  try {
    return res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

// GET /version - get server version info
router.get('/version', (req, res) => {
  try {
    return res.json({ version: process.env.APP_VERSION ?? 'unknown', node: process.version });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

// GET /debug-routes - get api docs
router.get('/debug-routes', (req, res) => {
  try {
    const routes: Array<{ method: string; path: string }> = [];
    req.app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // routes registered directly on the app
        const route = middleware.route;
        const methods = Object.keys(route.methods);
        methods.forEach(method => {
          routes.push({ method: method.toUpperCase(), path: route.path });
        });
      } else if (middleware.name === 'router') {
        // router middleware 
        middleware.handle.stack.forEach((handler: any) => {
          if (handler.route) {
            const route = handler.route;
            const methods = Object.keys(route.methods);
            methods.forEach(method => {
              routes.push({ method: method.toUpperCase(), path: route.path });
            });
          }
        });
      }
    });
    return res.json(routes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

export default router;