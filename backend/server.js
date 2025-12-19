const express = require('express');
const app = express();
const path = require('path');
const hbs = require('hbs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const db = require('./database');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Create HTTP server and Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 80;

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true when using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set view engine and views directory
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Register helper for date formatting
hbs.registerHelper('formatDate', function(date) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return new Date(date).toLocaleDateString('en-US', options);
});

// Register helper for equality check
hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

// Register helper for logical OR check
hbs.registerHelper('or', function(a, b) {
    return a || b;
});

// Register helper for greater than check
hbs.registerHelper('gt', function(a, b) {
    return a > b;
});

// Middleware to parse form submits
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); // Add JSON parsing for API requests
app.use(cookieParser());

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Database helper functions
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

function getCommentsFromDB(limit = 50, offset = 0) {
    return db.prepare(`
        SELECT c.id, c.user_id, c.text, c.created_at, c.updated_at, c.is_edited, c.edit_count, 
               u.display_name, u.username, u.profile_color, u.profile_avatar 
        FROM comments c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);
}

function addCommentToDB(userId, text) {
    return db.prepare(`
        INSERT INTO comments (user_id, text, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(userId, text);
}

// Home page - now uses session data
app.get('/', (req, res) => {
    const user = getCurrentUser(req);
    res.render('home', { user: user });
});

// Page to login - redirect to auth routes
app.get('/login', (req, res) => {
    const resetParam = req.query.reset ? `?reset=${req.query.reset}` : '';
    res.redirect(`/api/auth/login${resetParam}`);
});

app.get('/register', (req, res) => {
    res.redirect('/api/auth/register');
});

// Profile page
app.get('/profile', (req, res) => {
    const user = getCurrentUser(req);
    
    // Redirect to login if not authenticated
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    res.render('profile', { user: user });
});

// Comments page
app.get('/comments', (req, res) => {
    const user = getCurrentUser(req);
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 20; // Comments per page
    const offset = (page - 1) * limit;
    
    // Get comments from database
    const comments = getCommentsFromDB(limit, offset);
    
    // Get total comment count for pagination
    const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get().count;
    const totalPages = Math.ceil(totalComments / limit);
    
    // Format comments for display
    const formattedComments = comments.map(comment => ({
        id: comment.id,
        author: comment.display_name || comment.username,
        text: comment.text,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        isEdited: comment.is_edited || false,
        editCount: comment.edit_count || 0,
        profileColor: comment.profile_color || '#000000',
        profileAvatar: comment.profile_avatar || '👤',
        canEdit: user.loggedIn && user.id === comment.user_id
    }));
    
    res.render('comments', { 
        user: user, 
        comments: formattedComments,
        currentPage: page,
        totalPages: totalPages,
        totalComments: totalComments,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
    });
});

// Add comment page
app.get('/comments/addcomment', (req, res) => {
    const user = getCurrentUser(req);
    
    // Redirect to login if not authenticated
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    res.render('addcomment', { user: user });
});

// Add new comment
app.post('/comments/addcomment', (req, res) => {
    const user = getCurrentUser(req);
    
    // Only allow logged-in users to post comments
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    const commentText = (req.body && req.body.text) ? req.body.text.trim() : '';
    
    if (commentText && commentText.length > 0) {
        try {
            addCommentToDB(user.id, commentText);
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    }
    
    res.redirect('/comments');
});

// Edit comment page
app.get('/comments/edit/:id', (req, res) => {
    const user = getCurrentUser(req);
    
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    const commentId = parseInt(req.params.id);
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    
    if (!comment || comment.user_id !== user.id) {
        return res.redirect('/comments');
    }
    
    res.render('editcomment', { 
        user: user,
        comment: comment
    });
});

// Update comment
app.post('/comments/edit/:id', (req, res) => {
    const user = getCurrentUser(req);
    
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    const commentId = parseInt(req.params.id);
    const newText = req.body.text ? req.body.text.trim() : '';
    
    if (!newText || newText.length === 0) {
        return res.redirect(`/comments/edit/${commentId}`);
    }
    
    // Verify ownership
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment || comment.user_id !== user.id) {
        return res.redirect('/comments');
    }
    
    // Update comment
    db.prepare(`
        UPDATE comments 
        SET text = ?, is_edited = 1, edit_count = edit_count + 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(newText, commentId);
    
    res.redirect('/comments');
});

// Delete comment
app.delete('/comments/delete/:id', (req, res) => {
    const user = getCurrentUser(req);
    
    if (!user.loggedIn) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    
    const commentId = parseInt(req.params.id);
    
    // Verify ownership
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
        return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    
    if (comment.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }
    
    // Delete comment
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    
    res.json({ success: true, message: 'Comment deleted successfully' });
});

// Mount auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Mount profile routes and pass io instance
const profileRoutes = require('./routes/profile');
app.use('/profile', (req, res, next) => {
    req.io = io; // Make Socket.IO instance available in profile routes
    next();
}, profileRoutes);

// Import and add poke email functionality
const { sendPokeEmail } = require('./modules/sendEmail');

// Chat page
app.get('/chat', (req, res) => {
    const user = getCurrentUser(req);
    
    // Redirect to login if not authenticated
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    // Get recent chat messages (last 50)
    const messages = db.prepare(`
        SELECT cm.*, u.display_name, u.username, u.profile_color, u.profile_avatar 
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        ORDER BY cm.created_at DESC
        LIMIT 50
    `).all().reverse(); // Reverse to show oldest first
    
    res.render('chat', { 
        user: user,
        messages: messages
    });
});

// Poke email route
app.post('/send-poke', async (req, res) => {
  try {
    const result = await sendPokeEmail();
    if (result.success) {
      res.json({ success: true, message: 'Poke sent successfully! 👋' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send poke email' });
    }
  } catch (error) {
    console.error('Poke email error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Chat page
app.get('/chat', (req, res) => {
    const user = getCurrentUser(req);
    
    // Redirect to login if not authenticated
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    // Get recent chat messages (last 50)
    const messages = db.prepare(`
        SELECT cm.*, u.display_name, u.username, u.profile_color, u.profile_avatar
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        ORDER BY cm.created_at DESC
        LIMIT 50
    `).all().reverse(); // Reverse to show oldest first
    
    res.render('chat', { 
        user: user,
        messages: messages
    });
});

// Socket.IO chat functionality
io.on('connection', (socket) => {
    console.log('User connected to chat:', socket.id);
    
    // Join chat room
    socket.on('join-chat', (userData) => {
        socket.userData = userData;
        socket.join('main-chat');
        
        // Notify others that user joined
        socket.to('main-chat').emit('user-joined', {
            username: userData.displayName || userData.username,
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle new chat messages
    socket.on('chat-message', (data) => {
        try {
            const { message, userId } = data;
            
            if (!message || !userId) {
                return;
            }
            
            // Get user info
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user) {
                return;
            }
            
            // Save message to database
            const result = db.prepare(`
                INSERT INTO chat_messages (user_id, message, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `).run(userId, message);
            
            // Prepare message data for broadcast
            const messageData = {
                id: result.lastInsertRowid,
                message: message,
                user_id: userId,
                display_name: user.display_name || user.username,
                username: user.username,
                profile_color: user.profile_color || '#000000',
                profile_avatar: user.profile_avatar || '👤',
                created_at: new Date().toISOString()
            };
            
            // Broadcast message to all other users in chat (excluding sender)
            socket.broadcast.to('main-chat').emit('new-message', messageData);
            
            // Send confirmation back to sender
            socket.emit('message-sent', messageData);
            
            console.log(`Chat message from ${user.username}: ${message}`);
            
        } catch (error) {
            console.error('Error handling chat message:', error);
        }
    });
    
    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected from chat:', socket.id);
        
        if (socket.userData) {
            socket.to('main-chat').emit('user-left', {
                username: socket.userData.displayName || socket.userData.username,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Handle cookie reset (legacy support)
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('name'); // Clear old cookie format
        res.redirect('/');
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});