import { WebSocketServer } from 'ws';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { asyncLocalStorage } from '../server/lib/orm/asyncContext.js';
import pool from './config/db.js';
import modelLoader from './models/index.js';
import controllerLoader from './controllers/index.js';
import logger from './lib/logger.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to uploads directory
const UPLOADS_DIR = path.join(__dirname, '../storage/uploads');

// Check for command line arguments
const args = process.argv.slice(2);
const forceSyncSchema = args.includes('--sync-schema') || args.includes('-s');
const forceReseed = args.includes('--seed') || args.includes('-d');
const skipSeeders = args.includes('--no-seed');

// Load models and controllers
const models = await modelLoader.init({ 
    forceSyncSchema,
    runSeeders: !skipSeeders,
    forceReseed
});
const controllers = await controllerLoader.init();

const rateLimiter = new RateLimiterMemory({ points: 100, duration: 60 });
const clients = new Set();

// Create HTTP server to serve files and host WebSocket
const server = http.createServer((req, res) => {
  // Simple handling of file requests for uploads
  if (req.url.startsWith('/uploads/')) {
    const filename = req.url.replace('/uploads/', '');
    
    // Decode URL if it contains encoded characters
    const decodedFilename = decodeURIComponent(filename);
    
    // Sanitize the filename to prevent directory traversal
    const sanitizedFilename = path.normalize(decodedFilename).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(UPLOADS_DIR, sanitizedFilename);
    
    console.log(`File request for: ${decodedFilename}`);
    console.log(`Looking for file at: ${filePath}`);
    
    // Check if file exists
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        console.error(`File not found: ${filePath}`, err ? err.message : 'Not a file');
        
        // Log all files in the uploads directory to help debug
        fs.readdir(UPLOADS_DIR, (dirErr, files) => {
          if (!dirErr) {
            console.log(`Files available in ${UPLOADS_DIR}:`, files);
          } else {
            console.error(`Error reading uploads directory: ${dirErr.message}`);
          }
        });
        
        res.writeHead(404, {
          'Content-Type': 'text/plain',
          // Add CORS headers
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end('File not found');
        return;
      }
      
      // Determine content type based on extension
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      // Map common extensions to MIME types
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.zip': 'application/zip'
      };
      
      if (ext in mimeTypes) {
        contentType = mimeTypes[ext];
      }
      
      console.log(`Serving file: ${filePath}, size: ${stats.size}, type: ${contentType}`);
      
      // Set response headers
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        // Add CORS headers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Add cache control - set to no-cache for debugging
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      // Stream the file to the response
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      
      // Handle errors
      readStream.on('error', (streamErr) => {
        console.error(`Error streaming file ${filePath}:`, streamErr.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error streaming file');
        } else {
          res.end();
        }
      });
    });
  } else if (req.method === 'OPTIONS') {
    // Handle preflight CORS requests
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400' // 24 hours
    });
    res.end();
  } else {
    // For any other requests
    res.writeHead(404, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end('Not found');
  }
});

// Create WebSocket server on the HTTP server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', handleClientConnection);
wss.on('error', (error) => logger.error('Server error:', error));
pool.on('error', (error) => logger.error('Pool error:', error));

// Handle individual client connections
async function handleClientConnection(ws) {
  clients.add(ws);
  logger.info('Client connected');

  ws.on('message', async (message) => {
    let client;
    try {
      await rateLimiter.consume(ws._socket.remoteAddress);
      const request = JSON.parse(message);

      // Special handling for authentication requests
      if (request.type === 'controller' && request.name === 'Auth') {
        // Authentication requests don't require a token
        // Acquire a client from the pool
        client = await pool.connect();

        // Run the request processing in an AsyncLocalStorage context
        await asyncLocalStorage.run({ client }, async () => {
          await client.query('BEGIN');

          // Process the authentication request
          const result = await handleControllerRequest('Auth', request.action, request.parameters || {});

          await client.query('COMMIT');
          ws.send(JSON.stringify({
            success: true,
            type: request.type,
            data: result,
            requestId: request.requestId
          }));
        });
        
        if (client) {
          client.release();
        }
        return;
      }

      // Check for heartbeat requests which don't need authentication
      if (request.type === 'heartbeat') {
        // Send heartbeat response
        ws.send(JSON.stringify({ 
          type: 'heartbeat_response',
          timestamp: Date.now(),
          success: true
        }));
        return;
      }

      // For all other requests, verify token using Auth controller directly
      if (!request.token) {
        ws.send(JSON.stringify({ 
          success: false, 
          message: 'Unauthorized. Please authenticate first.',
          requestId: request.requestId
        }));
        return;
      }
      
      // Verify token using the Auth controller
      const verificationResult = await controllers.Auth.verifyToken(request.token);
      if (!verificationResult.success) {
        ws.send(JSON.stringify({ 
          success: false, 
          message: verificationResult.message || 'Unauthorized. Please authenticate first.',
          requestId: request.requestId
        }));
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

        // Process controller request only
        if (type === 'controller') {
          result = await handleControllerRequest(name, action, parameters);
        } else {
          throw new Error('Invalid request type. Only "controller" is supported');
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

// Main function to start the server (unchanged)
async function main() {
  const { PORT = 8011 } = process.env;
  
  // Start HTTP server
  server.listen(PORT, () => {
    logger.success(`HTTP server running on http://localhost:${PORT}`);
    logger.success(`WebSocket server running on ws://localhost:${PORT}`);
    logger.info(`File uploads accessible at http://localhost:${PORT}/uploads/filename`);
  });
  
  // Handle shutdown
  async function shutdown() {
    server.close();
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