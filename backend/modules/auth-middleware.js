// modules/auth-middleware.js

/**
 * Middleware to check if user is authenticated
 * Returns 401 if not authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Authentication Required</title></head>
      <body>
        <h1>Authentication Required</h1>
        <p>You must be logged in to access this page.</p>
        <p><a href="/api/auth/login">Login here</a></p>
        <p><a href="/">← Back to Home</a></p>
      </body>
      </html>
    `);
  }
}

module.exports = {
  requireAuth
};
