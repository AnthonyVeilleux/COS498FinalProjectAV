// routes/profile.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

/**
 * POST /update-display-name - Update user's display name
 */
router.post('/update-display-name', requireAuth, (req, res) => {
    try {
        const { displayName } = req.body;
        const userId = req.session.userId;
        
        // Validate input
        if (!displayName || displayName.trim().length === 0) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Display name cannot be empty' 
            });
        }
        
        if (displayName.trim().length > 100) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Display name must be 100 characters or less' 
            });
        }
        
        // Update display name in database
        db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName.trim(), userId);
        
        // Update session to reflect the change immediately
        req.session.displayName = displayName.trim();
        
        // Get refreshed user data for the response
        const updatedUser = getCurrentUser(req);
        
        res.render('profile', { 
            user: updatedUser,
            successMessage: 'Display name updated successfully! All your comments now show the new name.' 
        });
        
    } catch (error) {
        console.error('Error updating display name:', error);
        res.render('profile', { 
            user: getCurrentUser(req),
            errorMessage: 'An error occurred while updating display name' 
        });
    }
});

/**
 * POST /update-email - Update user's email address
 */
router.post('/update-email', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newEmail } = req.body;
        const userId = req.session.userId;
        
        // Validate input
        if (!currentPassword || !newEmail) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Current password and new email are required' 
            });
        }
        
        // Get current user data to verify password
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'User not found' 
            });
        }
        
        // Verify current password
        const passwordValid = await comparePassword(currentPassword, user.password_hash);
        if (!passwordValid) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Current password is incorrect' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Please enter a valid email address' 
            });
        }
        
        // Check if email is already in use by another user
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, userId);
        if (existingUser) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'This email address is already in use by another account' 
            });
        }
        
        // Update email in database
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, userId);
        
        res.render('profile', { 
            user: getCurrentUser(req),
            successMessage: 'Email address updated successfully!' 
        });
        
    } catch (error) {
        console.error('Error updating email:', error);
        res.render('profile', { 
            user: getCurrentUser(req),
            errorMessage: 'An error occurred while updating email address' 
        });
    }
});

/**
 * POST /update-avatar - Update user's avatar emoji
 */
router.post('/update-avatar', requireAuth, (req, res) => {
    try {
        const { avatar } = req.body;
        const userId = req.session.userId;
        
        // List of allowed avatars (prevent injection)
        const allowedAvatars = ['😊', '😎', '🤓', '😴', '🤩', '🥳', '🤖', '👻', '🦊', '🐱', '🐶', '🚀', ''];
        
        if (avatar && !allowedAvatars.includes(avatar)) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Invalid avatar selection' 
            });
        }
        
        // Update avatar in database (empty string for default)
        const avatarValue = avatar || null;
        db.prepare('UPDATE users SET profile_avatar = ? WHERE id = ?').run(avatarValue, userId);
        
        // Get refreshed user data for the response
        const updatedUser = getCurrentUser(req);
        
        // Emit avatar update event to all connected chat users via Socket.IO
        if (req.io) {
            req.io.to('main-chat').emit('avatar-updated', {
                userId: userId,
                username: updatedUser.username,
                displayName: updatedUser.displayName,
                newAvatar: avatarValue || '👤'
            });
        }
        
        res.render('profile', { 
            user: updatedUser,
            successMessage: 'Avatar updated successfully! Your new avatar will appear in comments and chat.' 
        });
        
    } catch (error) {
        console.error('Error updating avatar:', error);
        res.render('profile', { 
            user: getCurrentUser(req),
            errorMessage: 'An error occurred while updating avatar' 
        });
    }
});

/**
 * POST /change-password - Change user's password
 */
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.userId;
        
        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'All password fields are required' 
            });
        }
        
        if (newPassword !== confirmPassword) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'New passwords do not match' 
            });
        }
        
        // Validate new password requirements
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            const errorsText = validation.errors.join(', ');
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Password does not meet requirements: ' + errorsText 
            });
        }
        
        // Get current user data
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'User not found' 
            });
        }
        
        // Verify current password
        const currentPasswordValid = await comparePassword(currentPassword, user.password_hash);
        if (!currentPasswordValid) {
            return res.render('profile', { 
                user: getCurrentUser(req),
                errorMessage: 'Current password is incorrect' 
            });
        }
        
        // Hash new password and update
        const newPasswordHash = await hashPassword(newPassword);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);
        
        res.render('profile', { 
            user: getCurrentUser(req),
            successMessage: 'Password changed successfully!' 
        });
        
    } catch (error) {
        console.error('Error changing password:', error);
        res.render('profile', { 
            user: getCurrentUser(req),
            errorMessage: 'An error occurred while changing password' 
        });
    }
});

// Helper function to get current user (duplicate from server.js for now)
function getCurrentUser(req) {
    if (req.session && req.session.userId) {
        const user = db.prepare(`
            SELECT id, username, display_name, email, profile_color, profile_avatar 
            FROM users WHERE id = ?
        `).get(req.session.userId);
        
        if (user) {
            return {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                profileColor: user.profile_color,
                profileAvatar: user.profile_avatar,
                loggedIn: true
            };
        }
    }
    
    return {
        name: "Guest",
        displayName: "Guest", 
        msg: "Welcome! Please login or register.",
        loggedIn: false
    };
}

module.exports = router;