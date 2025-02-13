// index.js - Main entry point for your application

import { WebSocketServer } from 'ws';
import pool from './config/db.js';
import ora from 'ora';
import Models from './models/index.js';

/**
 * Main function that synchronizes the database schemas
 * and starts the WebSocket server.
 */
async function main() {
  try {

    const spinner = ora('Loading data...').start();




    // Create the customer record.
    const newCustomer = await Models.Customer.findById(1);
    console.log(newCustomer);

    // Create the WebSocket server on port 8011 using WebSocketServer
    const wss = new WebSocketServer({ port: 8011 });
    console.log('WebSocket server running on ws://localhost:8011');

    // Listen for client connections
    wss.on('connection', handleClientConnection);

    spinner.succeed('System initialized.');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

/**
 * Handles each new WebSocket client connection.
 * @param {WebSocket} ws - The connected client WebSocket instance.
 */
async function handleClientConnection(ws) {
  console.log('Client connected');

  let client;
  try {
    client = await pool.connect();

    // For now, just send a status message back to the client
    ws.send(JSON.stringify({ success: true, message: 'Database operation succeeded' }));
  } catch (error) {
    console.error('Error during client handling:', error);
    ws.send(JSON.stringify({ success: false, message: 'Internal server error' }));
  } finally {
    if (client) client.release();
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });
}

// Start the application
main();