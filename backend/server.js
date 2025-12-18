const express = require('express');
const app = express();
const path = require('path');
const hbs = require('hbs');
const cookieParser = require('cookie-parser');

const PORT = 80 ;

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

// Middleware to parse form submits
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// User storage
let users = {"steve": "steve123","john": "john123","brandon": "brandon123"};
let comments = [
    { id: 1, author: "steve", text: "This is a sample comment from Steve!", createdAt: new Date('2025-11-06T10:30:00') },
    { id: 2, author: "john", text: "Awesome.", createdAt: new Date('2025-11-06T14:15:00') },
    { id: 3, author: "brandon", text: "Hello Troy!", createdAt: new Date('2025-11-07T09:45:00') }
];
let nextCommentId = 4;
// Check login
function checkLogin(username, password) {
    return users[username] && users[username] === password;
}``

// Add new user
function addUser(username, password) {
    users[username] = password;
}

// Home page - now reads cookie data
app.get('/', (req, res) => {
    let user = {
        name: "Guest",
        msg: "Welcome! Please set your name.",
        loggedIn: false
    };
    
    // Check if cookie exists and parse it
    if (req.cookies && req.cookies.name) {
        user = JSON.parse(req.cookies.name);
    }
    
    res.render('home', { user: user });
});

// Page to change name
app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

// Comments page
app.get('/comments', (req, res) => {
    let user = {
        name: "Guest",
        msg: "Welcome! Please set your name.",
        loggedIn: false
    };
    
    // Check if cookie exists and parse it
    if (req.cookies && req.cookies.name) {
        user = JSON.parse(req.cookies.name);
    }
    
    // Sort comments by newest first
    const sortedComments = comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.render('comments', { user: user, comments: sortedComments });
});

// Add comment page
app.get('/comments/addcomment', (req, res) => {
    let user = {
        name: "Guest",
        msg: "Welcome! Please set your name.",
        loggedIn: false
    };
    
    // Check if cookie exists and parse it
    if (req.cookies && req.cookies.name) {
        user = JSON.parse(req.cookies.name);
    }
    
    // Redirect to login if not authenticated
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    res.render('addcomment', { user: user });
});

// Add new comment
app.post('/comments/addcomment', (req, res) => {
    let user = {
        name: "Guest",
        loggedIn: false
    };
    
    // Check if cookie exists and parse it
    if (req.cookies && req.cookies.name) {
        user = JSON.parse(req.cookies.name);
    }
    
    // Only allow logged-in users to post comments
    if (!user.loggedIn) {
        return res.redirect('/login');
    }
    
    const commentText = (req.body && req.body.text) ? req.body.text.trim() : '';
    
    if (commentText) {
        const newComment = {
            id: nextCommentId++,
            author: user.name,
            text: commentText,
            createdAt: new Date()
        };
        
        comments.push(newComment);
    }
    
    res.redirect('/comments');
});

// Handle form submission - now sets a cookie
app.post('/login', (req, res) => {
    const name = (req.body && req.body.name) ? req.body.name : '';
    const password = (req.body && req.body.password) ? req.body.password : '';
    
    let message;
    let isLoggedIn = false;
    
    // Check if login is valid
    if (name && password && checkLogin(name, password)) {
        message = "Successfully logged in!";
        isLoggedIn = true;
    } else if (name && password) {
        message = "Invalid username or password!";
        isLoggedIn = false;
    } else {
        message = "Please enter both username and password!";
        isLoggedIn = false;
    }
    
    // Set cookie with user data
    res.cookie('name', JSON.stringify({
        name: name, 
        msg: message,
        loggedIn: isLoggedIn
    }), { 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false,
        sameSite: "lax"
    });
    
    res.redirect('/');
});

app.post('/register', (req, res) => {
    const name = (req.body && req.body.name) ? req.body.name : '';
    const password = (req.body && req.body.password) ? req.body.password : '';
    
    let message;
    let isLoggedIn = false;
    
    if (!name || !password) {
        message = "Please enter both username and password!";
    } else if (name in users) {
        message = "Username already exists!";
    } else {
        addUser(name, password);
        message = "Registration successful! You are now logged in.";
        isLoggedIn = true;
    }
    
    // Set cookie with user data
    res.cookie('name', JSON.stringify({
        name: name, 
        msg: message,
        loggedIn: isLoggedIn
    }), { 
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false,
        sameSite: "lax"
    });
    
    res.redirect('/');
});

// Handle cookie reset
app.post('/logout', (req, res) => {
    res.clearCookie('name');
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});