// database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file path
const dbPath = path.join(__dirname, 'data', 'forum.db');
console.log('Database path:', dbPath);

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

// Create database connection
console.log('Attempting to create database connection...');
const db = new Database(dbPath);
console.log('Database connection established');

// Enable foreign keys
db.pragma('foreign_keys = ON');
console.log('Foreign keys enabled');

// Initialize database schema
function initDatabase() {
  console.log('Initializing database schema...');
  
  try {
    // Users table
    console.log('Creating users table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        profile_color VARCHAR(7) DEFAULT '#000000',
        profile_avatar TEXT DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        is_locked BOOLEAN DEFAULT 0,
        lockout_until DATETIME DEFAULT NULL,
        failed_login_attempts INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT NULL
      )
    `);
    console.log('Users table created successfully');

    // Sessions table
    console.log('Creating sessions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_data TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Sessions table created successfully');

    // Comments table
    console.log('Creating comments table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        parent_id INTEGER DEFAULT NULL,
        is_edited BOOLEAN DEFAULT 0,
        edit_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `);
    console.log('Comments table created successfully');

    // Login attempts table
    console.log('Creating login_attempts table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        success BOOLEAN NOT NULL,
        failure_reason VARCHAR(100),
        attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT DEFAULT NULL
      )
    `);
    console.log('Login attempts table created successfully');

    // Password reset tokens table
    console.log('Creating password_reset_tokens table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Password reset tokens table created successfully');

    // Chat messages table
    console.log('Creating chat_messages table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Chat messages table created successfully');

    // Create indexes for performance
    console.log('Creating database indexes...');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Initialize database when module is loaded
initDatabase();

module.exports = db;