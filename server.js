const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3005;
const SECRET_KEY = process.env.SECRET_KEY || 'your_super_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve frontend files

// --- DATABASE SETUP (SQLite) ---
const DB_PATH = process.env.DB_PATH || './database.sqlite';
const db = new Database(DB_PATH);
console.log('Connected to the SQLite database.');

// Create Tables
db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    members TEXT
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    dueDate TEXT,
    projectId INTEGER,
    assignedTo TEXT,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY (projectId) REFERENCES projects(id)
)`);

// Helper: Authentication Middleware (Role-Based Access Control)
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // Contains id, name, role
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// --- AUTH ROUTES ---

// Signup: POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    
    // Validations
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
            const result = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`)
                .run(name, email, hashedPassword, role);
            res.status(201).json({ message: 'User created successfully', userId: result.lastInsertRowid });
        } catch (dbErr) {
            if (dbErr.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ message: 'Email already exists.' });
            }
            return res.status(500).json({ message: 'Database error.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Login: POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

    try {
        const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// --- PROJECT ROUTES ---

// Create Project: POST /api/projects (Admin only)
app.post('/api/projects', authenticate, (req, res) => {
    // Role-based access control
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const { name, description, members } = req.body;
    if (!name) return res.status(400).json({ message: 'Project name is required.' });

    const membersString = Array.isArray(members) ? members.join(',') : members;

    try {
        const result = db.prepare(`INSERT INTO projects (name, description, members) VALUES (?, ?, ?)`)
            .run(name, description, membersString);
        res.status(201).json({ id: result.lastInsertRowid, name, description, members: membersString });
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// Get Projects: GET /api/projects
app.get('/api/projects', authenticate, (req, res) => {
    try {
        const rows = db.prepare(`SELECT * FROM projects`).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// Complete Project: PATCH /api/projects/:id/complete (Admin only)
app.patch('/api/projects/:id/complete', authenticate, (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    const { id } = req.params;
    try {
        db.prepare(`UPDATE tasks SET status = 'Completed' WHERE projectId = ?`).run(id);
        res.json({ message: 'Project and all tasks marked as completed.' });
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// Get Users: GET /api/users
app.get('/api/users', authenticate, (req, res) => {
    try {
        const rows = db.prepare(`SELECT id, name, email, role FROM users`).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// --- TASK ROUTES ---

// Create Task: POST /api/tasks
app.post('/api/tasks', authenticate, (req, res) => {
    const { title, dueDate, projectId, assignedTo } = req.body;
    
    // Validations
    if (!title || !projectId) return res.status(400).json({ message: 'Title and Project ID are required.' });

    try {
        const result = db.prepare(`INSERT INTO tasks (title, dueDate, projectId, assignedTo, status) VALUES (?, ?, ?, ?, 'Pending')`)
            .run(title, dueDate, projectId, assignedTo);
        res.status(201).json({ id: result.lastInsertRowid, title, dueDate, projectId, assignedTo, status: 'Pending' });
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// Get Tasks: GET /api/tasks
app.get('/api/tasks', authenticate, (req, res) => {
    try {
        const rows = db.prepare(`SELECT * FROM tasks`).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// Update Task Status: PATCH /api/tasks/:id
app.patch('/api/tasks/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }

    try {
        const result = db.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(status, id);
        if (result.changes === 0) return res.status(404).json({ message: 'Task not found.' });
        res.json({ message: 'Task updated', id, status });
    } catch (err) {
        res.status(500).json({ message: 'Database error.' });
    }
});

// Catch-all to serve index.html for frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
