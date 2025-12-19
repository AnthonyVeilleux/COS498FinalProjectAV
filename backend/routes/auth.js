// routes/auth.js
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const { sendPasswordResetEmail } = require('../modules/sendEmail');
const crypto = require('crypto');

/**
 * GET /register - Show registration form
 */
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

/**
 * GET /login - Show login form
 */
router.get('/login', (req, res) => {
  const resetSuccess = req.query.reset === 'success';
  const errorMessage = req.query.error;
  res.render('login', { 
    user: { loggedIn: false },
    resetSuccess: resetSuccess,
    error: errorMessage
  });
});

/**
 * POST /register - Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, displayName } = req.body;
    
    // Validate input
    if (!username || !password || !email || !displayName) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('All fields are required: username, password, email, and display name'));
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Please enter a valid email address'));
    }
    
    // Validate password requirements
    const validation = validatePassword(password);
    if (!validation.valid) {
      const errorsText = validation.errors.join(', ');
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Password does not meet requirements: ' + errorsText));
    }
    
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    
    if (existingUser) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Username already exists. Please choose a different username.'));
    }
    
    // Check if email already exists
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (existingEmail) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Email address already registered. Please use a different email.'));
    }
    
    try {
      // Hash the password before storing
      const passwordHash = await hashPassword(password);
      
      // Insert new user into database
      const result = db.prepare('INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)').run(username, passwordHash, email, displayName);
      
      // Redirect to success page with username
      res.redirect(`/public/register-success.html?username=${encodeURIComponent(username)}&userId=${result.lastInsertRowid}`);
      
    } catch (hashError) {
      console.error('Password hashing error:', hashError);
      res.redirect('/api/auth/register?error=' + encodeURIComponent('Error processing password. Please try again later.'));
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/public/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/register');
  }
});

/**
 * GET /login - Show login form
 */
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

/**
 * POST /login - Authenticate user
 */
router.post('/login', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
  
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      logLoginAttempt(username || '', clientIp, false, 'missing_credentials');
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Username and password are required'));
    }
    
    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      logLoginAttempt(username, clientIp, false, 'user_not_found');
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Invalid username or password'));
    }
    
    // Check if account is locked
    if (user.is_locked && user.lockout_until) {
      const lockoutEnd = new Date(user.lockout_until);
      const now = new Date();
      
      if (now < lockoutEnd) {
        logLoginAttempt(username, clientIp, false, 'account_locked');
        const remainingMinutes = Math.ceil((lockoutEnd - now) / (1000 * 60));
        return res.redirect('/api/auth/login?error=' + encodeURIComponent(`Account is locked. Try again in ${remainingMinutes} minutes.`));
      } else {
        // Lockout period expired, unlock account
        db.prepare('UPDATE users SET is_locked = FALSE, lockout_until = NULL, failed_login_attempts = 0 WHERE id = ?').run(user.id);
      }
    }
    
    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      handleFailedLogin(user.id, username, clientIp);
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Invalid username or password'));
    }
    
    // Successful login - reset failed attempts and update last login
    db.prepare(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP, 
          failed_login_attempts = 0, 
          is_locked = FALSE, 
          lockout_until = NULL 
      WHERE id = ?
    `).run(user.id);
    
    logLoginAttempt(username, clientIp, true, 'success');
    
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;
    req.session.isLoggedIn = true;
    
    // Redirect to success page using display name
    res.redirect(`/public/login-success.html?username=${encodeURIComponent(user.display_name || user.username)}`);
    
  } catch (error) {
    console.error('Login error:', error);
    logLoginAttempt(username || '', clientIp, false, 'server_error');
    res.redirect('/public/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

/**
 * GET /logout - Logout user (GET version for easy link access)
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/public/error.html?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/public/logged-out.html');
  });
});

/**
 * POST /logout - Logout user (POST version)
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/public/error.html?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/public/logged-out.html');
  });
});

/**
 * GET /me - Get current user info (requires authentication)
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/public/error.html?message=' + encodeURIComponent('You must be logged in to view this page.') + '&back=/api/auth/login');
  }
  
  const user = db.prepare(`
    SELECT id, username, email, display_name, profile_color, profile_avatar, 
           bio, created_at, last_login 
    FROM users WHERE id = ?
  `).get(req.session.userId);
  
  if (!user) {
    return res.redirect('/public/error.html?message=' + encodeURIComponent('User not found in database.') + '&back=/');
  }
  
  // Pass user data as query parameters to the profile page
  const params = new URLSearchParams({
    id: user.id,
    username: user.username,
    email: user.email || '',
    display_name: user.display_name || '',
    profile_color: user.profile_color || '#000000',
    profile_avatar: user.profile_avatar || '',
    bio: user.bio || '',
    created_at: user.created_at || 'N/A',
    last_login: user.last_login || 'Never'
  });
  
  res.redirect(`/public/profile.html?${params.toString()}`);
});

// Helper functions for login attempt tracking
function logLoginAttempt(username, ipAddress, success, failureReason = null) {
  try {
    db.prepare(`
      INSERT INTO login_attempts (username, ip_address, success, failure_reason)
      VALUES (?, ?, ?, ?)
    `).run(username, ipAddress, success ? 1 : 0, failureReason);
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
}

function handleFailedLogin(userId, username, ipAddress) {
  try {
    // Increment failed login attempts
    db.prepare(`
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1 
      WHERE id = ?
    `).run(userId);
    
    // Get updated user info
    const user = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(userId);
    
    // Check if account should be locked (5 failed attempts)
    if (user && user.failed_login_attempts >= 5) {
      const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      db.prepare(`
        UPDATE users 
        SET is_locked = TRUE, lockout_until = ? 
        WHERE id = ?
      `).run(lockoutUntil.toISOString(), userId);
      
      logLoginAttempt(username, ipAddress, false, 'account_locked_after_attempts');
    } else {
      logLoginAttempt(username, ipAddress, false, 'invalid_password');
    }
  } catch (error) {
    console.error('Error handling failed login:', error);
  }
}

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        
        // Check if user exists
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        // Always return success to prevent email enumeration attacks
        if (!user) {
            return res.json({ 
                success: true, 
                message: 'If an account with that email exists, a password reset link has been sent.' 
            });
        }
        
        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expirationTime = new Date(Date.now() + 3600000); // 1 hour from now
        
        // Store reset token in database
        db.prepare(`
            INSERT OR REPLACE INTO password_reset_tokens (user_id, token, expires_at, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(user.id, resetToken, expirationTime.toISOString());
        
        // Send reset email
        const emailResult = await sendPasswordResetEmail(email, resetToken, expirationTime);
        
        if (emailResult.success) {
            console.log(`Password reset email sent to ${email}`);
            res.json({ 
                success: true, 
                message: 'If an account with that email exists, a password reset link has been sent.' 
            });
        } else {
            console.error('Failed to send password reset email:', emailResult.error);
            res.status(500).json({ 
                success: false, 
                message: 'Error sending reset email. Please try again later.' 
            });
        }
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error. Please try again later.' 
        });
    }
});

// Reset Password Page Route
router.get('/reset-password', (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.render('reset-password', { 
            invalidToken: true,
            user: { loggedIn: false }
        });
    }
    
    // Validate token exists and hasn't expired
    const resetRecord = db.prepare(`
        SELECT * FROM password_reset_tokens 
        WHERE token = ? AND expires_at > datetime('now')
    `).get(token);
    
    if (!resetRecord) {
        const expiredRecord = db.prepare(`
            SELECT * FROM password_reset_tokens WHERE token = ?
        `).get(token);
        
        return res.render('reset-password', { 
            tokenExpired: !!expiredRecord,
            invalidToken: !expiredRecord,
            user: { loggedIn: false }
        });
    }
    
    res.render('reset-password', {
        token: token,
        user: { loggedIn: false }
    });
});

// Reset Password Form Submission Route
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;
        
        if (!token || !password || !confirmPassword) {
            return res.render('reset-password', {
                token: token,
                error: 'All fields are required',
                user: { loggedIn: false }
            });
        }
        
        if (password !== confirmPassword) {
            return res.render('reset-password', {
                token: token,
                error: 'Passwords do not match',
                user: { loggedIn: false }
            });
        }
        
        if (password.length < 8) {
            return res.render('reset-password', {
                token: token,
                error: 'Password must be at least 8 characters long',
                user: { loggedIn: false }
            });
        }
        
        // Validate token exists and hasn't expired
        const resetRecord = db.prepare(`
            SELECT prt.*, u.id as user_id, u.email 
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = ? AND prt.expires_at > datetime('now')
        `).get(token);
        
        if (!resetRecord) {
            return res.render('reset-password', {
                tokenExpired: true,
                user: { loggedIn: false }
            });
        }
        
        // Hash the new password
        const hashedPassword = await hashPassword(password);
        
        // Update user's password
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            .run(hashedPassword, resetRecord.user_id);
        
        // Invalidate the reset token
        db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
        
        // Invalidate all sessions for this user for security
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(resetRecord.user_id);
        
        console.log(`Password successfully reset for user: ${resetRecord.email}`);
        
        // Redirect to login with success message
        res.redirect('/login?reset=success');
        
    } catch (error) {
        console.error('Password reset error:', error);
        res.render('reset-password', {
            token: req.body.token,
            error: 'Error resetting password. Please try again.',
            user: { loggedIn: false }
        });
    }
});

module.exports = router;
