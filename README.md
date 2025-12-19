# Epic Forum Application

A comprehensive forum application with real-time chat, user authentication, and administrative features. Built with Node.js, Express.js, Socket.IO, and Docker, featuring a modern web interface and robust security implementations.

## Features

### Core Functionality
- **User Authentication**: Secure registration and login with session management
- **Profile Management**: Customizable display names, avatars, and email settings
- **Comment System**: Threaded discussions with edit/delete capabilities
- **Real-time Chat**: Live messaging with Socket.IO and avatar synchronization
- **Security Features**: Rate limiting, password validation, account lockout protection

### Technical Features  
- **Dockerized Deployment**: Both development and production configurations
- **Nginx Proxy Manager**: SSL termination and reverse proxy
- **Database**: SQLite with comprehensive schema
- **Email Service**: Password recovery and notifications via Gmail
- **Real-time Updates**: Avatar changes reflect instantly in chat

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### 1. Clone and Setup
```bash
git clone https://github.com/AnthonyVeilleux/COS498FinalProjectAV.git
cd COS498FinalProjectAV
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```bash
# Email Service Configuration (Required for password recovery)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-specific-password

# Session Security (Optional - will use default if not set)
SESSION_SECRET=your-secure-random-string-change-in-production
```

### 3. Run the Application

**Production Mode:**
```bash
sudo docker compose up -d
```
- Application: `http://goob.site`
- nginx Admin: `http://goob.site:5001`

**Development Mode:**
```bash
sudo docker compose -f docker-compose.dev.yml up -d
```
- Application: `http://goob.site` (via nginx) or `http://goob.site:3000` (direct)
- nginx Admin: `http://goob.site:5001`

### 4. Stop the Application
```bash
sudo docker compose down
```

---

## Database Schema

The application uses SQLite with the following core tables:

### Users Table
```sql
CREATE TABLE users (
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
);
```

### Comments Table
```sql
CREATE TABLE comments (
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
);
```

### Chat Messages Table
```sql
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Additional Tables
- **sessions**: Session management and persistence
- **login_attempts**: Security logging and rate limiting
- **password_reset_tokens**: Secure password recovery system

**Database Location**: `backend/data/forum.db` (excluded from git)

---

## Environment Variables & Configuration

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `GMAIL_USER` | Gmail address for sending emails | `your-app@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not regular password) | `abcd efgh ijkl mnop` |

### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | Secret key for session encryption | Auto-generated |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `80` |

### Gmail App Password Setup
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password: [Google Account Settings](https://myaccount.google.com/apppasswords)
3. Use the 16-character app password in `GMAIL_APP_PASSWORD`

---

## nginx Proxy Manager Setup

### Automatic Setup (Development)
The development configuration includes nginx Proxy Manager with the following endpoints:

- **Application**: `http://goob.site:80` (HTTP) / `https://goob.site:443` (HTTPS)
- **Admin Interface**: `http://goob.site:5001`
- **Direct Backend**: `http://goob.site:3000` (dev mode only)

### Manual Configuration
1. Access admin interface: `http://goob.site:5001`
2. Default login: `admin@example.com` / `changeme`
3. Add proxy host pointing to `backend-nodejs:80`
4. Configure SSL certificates via Let's Encrypt

### Production Considerations
- Change default admin credentials immediately
- Configure proper domain names
- Set up SSL certificates
- Review security headers

---

## Email Service Configuration

The application uses Gmail SMTP for email services:

### Features
- Password recovery emails
- Account verification (if enabled)
- Administrative notifications

### Configuration Steps
1. **Enable 2FA**: Required for App Passwords
2. **Generate App Password**: 
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate new password for "Mail"
3. **Update Environment**: Set `GMAIL_USER` and `GMAIL_APP_PASSWORD`

### Email Templates
Located in `backend/modules/sendEmail.js`:
- Password recovery with secure tokens
- HTML and text fallback formats
- Configurable sender information

---

## Security Features

### Authentication & Sessions
- **bcrypt Password Hashing**: Industry-standard password security
- **Session Management**: Server-side session storage with secure cookies
- **Account Lockout**: Automatic lockout after failed login attempts
- **Password Requirements**: Enforced complexity requirements

### Rate Limiting & Protection
```javascript
// Example: Login attempt tracking
const loginAttempt = {
  username: username,
  ip_address: req.ip,
  success: false,
  failure_reason: 'Invalid credentials',
  attempt_time: new Date(),
  user_agent: req.get('User-Agent')
};
```

### Input Validation
- **SQL Injection Protection**: Parameterized queries with better-sqlite3
- **XSS Prevention**: Input sanitization and output encoding
- **CSRF Protection**: Session-based request validation

### Password Security
```javascript
// Password requirements (from password-utils.js)
const requirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};
```

---

## API Documentation

### Chat API (Socket.IO Events)

#### Client → Server Events

**`join-chat`**
```javascript
socket.emit('join-chat', {
  id: userId,
  username: 'username',
  displayName: 'Display Name',
  profileColor: '#color',
  profileAvatar: '😊'
});
```

**`chat-message`**
```javascript
socket.emit('chat-message', {
  message: 'Hello world!',
  userId: 123
});
```

#### Server → Client Events

**`new-message`** / **`message-sent`**
```javascript
{
  id: 456,
  message: 'Hello world!',
  user_id: 123,
  display_name: 'Display Name',
  username: 'username',
  profile_color: '#color',
  profile_avatar: '😊',
  created_at: '2025-12-19T...'
}
```

**`avatar-updated`**
```javascript
{
  userId: 123,
  username: 'username',
  displayName: 'Display Name',
  newAvatar: '🚀'
}
```

**`user-joined`** / **`user-left`**
```javascript
{
  username: 'Display Name',
  timestamp: '2025-12-19T...'
}
```

### REST API Endpoints

#### Authentication
- `GET /api/auth/login` - Login page
- `POST /api/auth/login` - Process login
- `GET /api/auth/register` - Registration page
- `POST /api/auth/register` - Process registration
- `POST /api/auth/reset-password` - Password recovery

#### Profile Management
- `POST /profile/update-display-name` - Update display name
- `POST /profile/update-avatar` - Update avatar (triggers real-time chat update)
- `POST /profile/update-email` - Update email address
- `POST /profile/change-password` - Change password

#### Comments
- `GET /comments` - View comments with pagination
- `POST /comments/addcomment` - Add new comment
- `POST /comments/editcomment` - Edit existing comment
- `DELETE /api/comments/:id` - Delete comment


## Development

### File Structure
```
COS498FinalProjectAV/
├── backend/
│   ├── server.js           # Main application server
│   ├── database.js         # Database schema and initialization
│   ├── routes/             # Express route handlers
│   ├── modules/            # Utility modules (auth, email, etc.)
│   └── data/               # SQLite database files (gitignored)
├── views/                  # Handlebars templates
├── nginx/                  # nginx Proxy Manager configuration  
├── docker-compose.yml      # Production Docker configuration
├── docker-compose.dev.yml  # Development Docker configuration
└── README.md              # This file
```
