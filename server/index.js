import { WebSocketServer } from 'ws';
import pool from './config/db.js';
import Models from './models/index.js';

async function handleClientConnection(ws) {
  console.log('Client connected');

  ws.on('message', async (message) => {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      let request;
      try {
        request = JSON.parse(message);
      } catch (parseError) {
        console.error('Message parsing error:', parseError);
        ws.send(JSON.stringify({ success: false, message: 'Invalid JSON format' }));
        return;
      }

      // Destructure the request object
      const { model, action, data } = request;

      // Ensure the model exists in your Models object.
      const ModelClass = Models[model];
      if (!ModelClass) {
        throw new Error(`Model "${model}" not found`);
      }

      // Check if the action is a valid method on the model.
      if (typeof ModelClass[action] !== 'function') {
        throw new Error(`Action "${action}" is not available for model "${model}"`);
      }

      // Call the model operation. (e.g., ModelClass.create, ModelClass.find, etc.)
      const result = await ModelClass[action](data, client);

      await client.query('COMMIT');
      ws.send(JSON.stringify({ success: true, message: 'Operation succeeded', requestId: request.requestId, result }));

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error('Error during DB operation:', error);
      ws.send(JSON.stringify({ success: false, message: 'Operation failed', error: error.message }));
    } finally {
      if (client) client.release();
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}


async function main() {
  const wss = new WebSocketServer({ port: 8011 });
  console.log('WebSocket server running on ws://localhost:8011');

  wss.on('connection', handleClientConnection);

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  pool.on('error', (error) => {
    console.error('Database pool error:', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  process.on('exit', (code) => {
    console.log('Process exited with code:', code);
  });
}

// Start the application
main();