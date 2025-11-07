const express = require('express');

const app = express();
const PORT = process.env.PORT || 25565;  //you don't need to use your special IP anymore!


// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// Routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to my Node.js Express app!',
    timestamp: new Date().toISOString(),
  });
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
// Note: We use '0.0.0.0' instead of 'localhost' because Docker containers
// need to bind to all network interfaces to accept connections from outside the container
app.listen(PORT, '67.247.87.224', () => {
  console.log(`Server is running on port ${PORT}`);
});
