import { WebSocketServer } from 'ws';
import pool from './config/db.js';
import Models from './models/index.js';

async function handleClientConnection(ws) {
  console.log('Client connected');

  ws.on('message', async (message) => {
    let client;

    try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start transaction

      // Parse the received message
      let request;
      try {
        request = JSON.parse(message);
      } catch (parseError) {
        console.error('Message parsing error:', parseError);
        ws.send(JSON.stringify({ success: false, message: 'Invalid JSON format' }));
        return; // Exit early if JSON is invalid
      }

      const action = request.action;
      const data = request.data;

      // Handle the action
      let result;
      switch (action) {
        case 'createCustomer':
          result = await Models.Customer.create(data, client);
          break;
        // Add additional actions here
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      await client.query('COMMIT'); // Commit transaction if successful
      ws.send(JSON.stringify({ success: true, message: 'Operation succeeded', result }));

    } catch (error) {
      if (client) await client.query('ROLLBACK'); // Rollback transaction
      console.error('Error during DB operation:', error);
      ws.send(JSON.stringify({ success: false, message: 'Operation failed', error: error.message }));
    } finally {
      if (client) client.release(); // Release db client back to pool
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