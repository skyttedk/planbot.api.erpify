import { WebSocketServer } from 'ws';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { asyncLocalStorage } from '../server/lib/orm/asyncContext.js';
import pool from './config/db.js';
import modelLoader from './models/index.js';
import viewLoader from './views/index.js';
import controllerLoader from './controllers/index.js';
import logger from './lib/logger.js';
import { buildMenuStructure } from './lib/menuBuilder.js';

// Check for command line arguments
const args = process.argv.slice(2);
const forceSyncSchema = args.includes('--sync-schema') || args.includes('-s');

// Load all models, views, and controllers
const models = await modelLoader.init({ forceSyncSchema });
const views = await viewLoader.init();
const controllers = await controllerLoader.init();

const rateLimiter = new RateLimiterMemory({ points: 100, duration: 60 });
const clients = new Set();

// Placeholder for token verification
async function verifyToken(token) {
  return true; // Replace with real logic
}

// Handle individual client connections
async function handleClientConnection(ws) {
  clients.add(ws);
  logger.info('Client connected');

  ws.on('message', async (message) => {
    let client;
    try {
      await rateLimiter.consume(ws._socket.remoteAddress);
      const request = JSON.parse(message);

      if (!request.token || !(await verifyToken(request.token))) {
        ws.send(JSON.stringify({ success: false, message: 'Unauthorized' }));
        return;
      }

      // Acquire a client from the pool
      client = await pool.connect();

      // Run the request processing in an AsyncLocalStorage context
      await asyncLocalStorage.run({ client }, async () => {
        await client.query('BEGIN');

        // Extract common request properties
        const { type, name, action, parameters = {}, requestId } = request;
        let result;

        // Process request based on type (model, view, or controller)
        switch (type) {
          case 'model':
            result = await handleModelRequest(name, action, parameters);
            break;
          
          case 'view':
            result = await handleViewRequest(name, parameters);
            break;
          
          case 'controller':
            result = await handleControllerRequest(name, action, parameters);
            break;
          
          case 'menu':
            result = await handleMenuRequest();
            break;
          
          default:
            // For backward compatibility, assume it's a model request if no type specified
            if (request.model) {
              result = await handleModelRequest(request.model, action, parameters);
            } else {
              throw new Error('Invalid request type. Must be "model", "view", or "controller"');
            }
        }

        await client.query('COMMIT');
        ws.send(
          JSON.stringify({
            success: true,
            message: 'Operation succeeded',
            requestId: request.requestId,
            result,
          })
        );
      });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logger.error('Request error:', error);
      ws.send(JSON.stringify({ success: false, message: error.message }));
    } finally {
      if (client) client.release();
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    logger.info('Client disconnected');
  });

  ws.on('error', (error) => logger.error('WebSocket error:', error));
}

// Handle model requests (CRUD operations)
async function handleModelRequest(modelName, action, parameters) {
  const ModelClass = models[modelName];
  
  if (!ModelClass) {
    throw new Error(`Model "${modelName}" not found`);
  }
  if (typeof ModelClass[action] !== 'function') {
    throw new Error(`Action "${action}" not available for model "${modelName}"`);
  }
  
  // Construct parameters array
  const expectedParams = getFunctionParameters(ModelClass[action]);
  const paramArray = expectedParams.map((name) =>
    parameters[name] !== undefined ? parameters[name] : null
  );
  
  // Call the method
  return await ModelClass[action](...paramArray);
}

// Handle view requests (returning UI configurations)
async function handleViewRequest(viewName, parameters) {
  if (!views[viewName]) {
    throw new Error(`View "${viewName}" not found`);
  }
  
  // Views might be static configs or functions that generate configs
  if (typeof views[viewName] === 'function') {
    return await views[viewName](parameters);
  } else {
    return views[viewName];
  }
}

// Handle controller requests (business logic actions)
async function handleControllerRequest(controllerName, action, parameters) {
  const ControllerClass = controllers[controllerName];
  
  if (!ControllerClass) {
    throw new Error(`Controller "${controllerName}" not found`);
  }
  if (typeof ControllerClass[action] !== 'function') {
    throw new Error(`Action "${action}" not available for controller "${controllerName}"`);
  }
  
  // Construct parameters array
  const expectedParams = getFunctionParameters(ControllerClass[action]);
  const paramArray = expectedParams.map((name) =>
    parameters[name] !== undefined ? parameters[name] : null
  );
  
  // Call the controller method
  return await ControllerClass[action](...paramArray);
}

// Handle menu requests (returning the dynamically built menu structure)
async function handleMenuRequest() {
  logger.info('Handling menu request');
  // Build and return the menu structure from all views
  const menuStructure = buildMenuStructure(views);
  return menuStructure;
}

// Main function to start the server (unchanged)
async function main() {
  const { PORT = 8011 } = process.env;
  const wss = new WebSocketServer({ port: PORT });
  logger.success(`WebSocket server running on ws://localhost:${PORT}`);

  wss.on('connection', handleClientConnection);
  wss.on('error', (error) => logger.error('Server error:', error));
  pool.on('error', (error) => logger.error('Pool error:', error));

  async function shutdown() {
    wss.close();
    await pool.end();
    logger.info('Server shut down');
    process.exit(0);
  }
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('unhandledRejection', (reason) =>
    logger.error('Unhandled Rejection:', reason)
  );
  process.on('uncaughtException', (error) =>
    logger.error('Uncaught Exception:', error)
  );
}

main().catch((error) => logger.error('Server startup error:', error));

function getFunctionParameters(fn) {
  const fnStr = fn.toString();
  const paramStr = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'));
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map((param) => {
    const [name] = param.trim().split('=').map((s) => s.trim());
    return name;
  });
}

export { handleClientConnection, main };