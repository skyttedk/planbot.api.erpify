// ESM module for Node.js
import User from './server/models/User.js';
import pool from './server/config/db.js';

async function testPasswordStorage() {
  try {
    // Create a test user
    const testUser = {
      username: 'testuser' + Date.now(),
      password: 'Test@123',
      email: 'test@example.com',
      name: 'Test User',
      isAdmin: false,
      isActive: true
    };
    
    console.log('Creating test user...');
    const user = await User.create(testUser);
    console.log('User created:', { id: user.id, username: user.username });
    
    // Directly query the database to see how the password is stored
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT username, password FROM users WHERE username = $1', [testUser.username]);
      
      console.log('--------------------------------');
      console.log('Raw database record:');
      console.log('Username:', result.rows[0].username);
      console.log('Password:', result.rows[0].password);
      console.log('--------------------------------');
      
      // Check if password is hashed
      const isHashed = result.rows[0].password.startsWith('$2b$10$');
      console.log('Is password hashed?', isHashed ? 'YES ✓' : 'NO ✗');
      
      // Clean up - delete the test user
      await client.query('DELETE FROM users WHERE username = $1', [testUser.username]);
      console.log('Test user deleted');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await pool.end();
    console.log('Pool closed');
  }
}

// Run the test
testPasswordStorage(); 