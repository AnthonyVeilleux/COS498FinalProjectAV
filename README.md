# Epic Forum Application

A simple web application demonstrating cookie-based authentication using Node.js, Express.js, and Handlebars. Features user login/registration and a comment system.

## Features
- User registration and login with cookies
- Comment system for authenticated users
- Docker containerized

## Quick Start

1. **Clone and run**
   ```bash
   git clone https://github.com/AnthonyVeilleux/COS498MidtermAV.git
   cd COS498MidtermAV
   sudo docker compose up -d
   ```

2. **Access the app**
   - Open `http://localhost:25565` in your browser

3. **Test accounts**
   - `steve` / `steve123`
   - `john` / `john123` 
   - `brandon` / `brandon123`

## Development Mode
```bash
sudo docker compose -f docker-compose.dev.yml up -d
```

## Stop the app
```bash
sudo docker compose down
```

That's it! 🚀
