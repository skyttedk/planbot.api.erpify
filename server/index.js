import { WebSocketServer } from 'ws';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { asyncLocalStorage } from '../server/lib/orm/asyncContext.js'; // Import from new file
import pool from './config/db.js';
import Models from './models/index.js';

// Initialize AsyncLocalStorage
//const asyncLocalStorage = new AsyncLocalStorage();

const rateLimiter = new RateLimiterMemory({ points: 100, duration: 60 });
const clients = new Set();

// Placeholder for token verification
async function verifyToken(token) {
  return true; // Replace with real logic
}

// Handle individual client connections
async function handleClientConnection(ws) {
  clients.add(ws);
  console.log('Client connected');

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

        const { model, action, parameters = {}, requestId } = request;
        const ModelClass = Models[model];

        if (!ModelClass) {
          throw new Error(`Model "${model}" not found`);
        }
        if (typeof ModelClass[action] !== 'function') {
          throw new Error(`Action "${action}" not available for model "${model}"`);
        }

        // Construct parameters array
        const expectedParams = getFunctionParameters(ModelClass[action]);
        const paramArray = expectedParams.map((name) =>
          parameters[name] !== undefined ? parameters[name] : null
        );

        // Call the method without passing the client
        const result = await ModelClass[action](...paramArray);

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
      console.error('Error:', error);
      ws.send(JSON.stringify({ success: false, message: error.message }));
    } finally {
      if (client) client.release();
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });

  ws.on('error', (error) => console.error('WebSocket error:', error));
}

// Main function to start the server (unchanged)
async function main() {
  const { PORT = 8011 } = process.env;
  const wss = new WebSocketServer({ port: PORT });
  console.log(`WebSocket server running on ws://localhost:${PORT}`);

  wss.on('connection', handleClientConnection);
  wss.on('error', (error) => console.error('Server error:', error));
  pool.on('error', (error) => console.error('Pool error:', error));

  async function shutdown() {
    wss.close();
    await pool.end();
    console.log('Server shut down');
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('unhandledRejection', (reason) =>
    console.error('Unhandled Rejection:', reason)
  );
  process.on('uncaughtException', (error) =>
    console.error('Uncaught Exception:', error)
  );
}

main().catch(console.error);


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