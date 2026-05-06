const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3005;
const SECRET_KEY = process.env.SECRET_KEY || 'your_super_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve frontend files

// --- DATABASE SETUP (SQLite) ---
const DB_PATH = process.env.DB_PATH || './database.sqlite';
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create Tables
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            members TEXT,
            status TEXT DEFAULT 'Active'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            dueDate TEXT,
            projectId INTEGER,
            assignedTo TEXT,
            status TEXT DEFAULT 'Pending',
            FOREIGN KEY (projectId) REFERENCES projects(id)
        )`, () => {
            // Seed default data if empty
            seedDatabase();
        });
    }
});

async function seedDatabase() {
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding default admin...");
            const hashedPw = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", 
                ['Admin User', 'admin@example.com', hashedPw, 'Admin']);
        }
    });

    db.get("SELECT COUNT(*) as count FROM projects", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding demo project...");
            db.run("INSERT INTO projects (name, description, status) VALUES (?, ?, ?)", 
                ['Demo Project', 'Welcome to your new Task Manager! This is a sample project created automatically.', 'Active']);
        }
    });
}

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

    db.get(`SELECT id FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (user) return res.status(400).json({ message: 'Account already exists with this email.' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, 
                [name, email, hashedPassword, role], 
                function(err) {
                    if (err) {
                        return res.status(500).json({ message: 'Error creating account.' });
                    }
                    res.status(201).json({ message: 'User created successfully', userId: this.lastID });
                }
            );
        } catch (err) {
            res.status(500).json({ message: 'Server error' });
        }
    });
});

// Login: POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
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

    db.run(`INSERT INTO projects (name, description, members) VALUES (?, ?, ?)`,
        [name, description, membersString],
        function(err) {
            if (err) return res.status(500).json({ message: 'Database error.' });
            res.status(201).json({ id: this.lastID, name, description, members: membersString });
        }
    );
});

// Get Projects: GET /api/projects
app.get('/api/projects', authenticate, (req, res) => {
    db.all(`SELECT * FROM projects`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.json(rows);
    });
});

// Complete Project: PATCH /api/projects/:id/complete (Admin only)
app.patch('/api/projects/:id/complete', authenticate, (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    const { id } = req.params;
    
    // Update project status
    db.run(`UPDATE projects SET status = 'Completed' WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        
        // Mark all tasks of this project as completed
        db.run(`UPDATE tasks SET status = 'Completed' WHERE projectId = ?`, [id], function(err) {
            if (err) return res.status(500).json({ message: 'Database error.' });
            res.json({ message: 'Project and all tasks marked as completed.' });
        });
    });
});

// Update Project Members: PATCH /api/projects/:id/members (Admin only)
app.patch('/api/projects/:id/members', authenticate, (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    const { id } = req.params;
    const { members } = req.body; // Expecting a string or array

    const membersString = Array.isArray(members) ? members.join(',') : members;

    db.run(`UPDATE projects SET members = ? WHERE id = ?`, [membersString, id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Project not found.' });
        res.json({ message: 'Members updated', id, members: membersString });
    });
});

// Get Users: GET /api/users
app.get('/api/users', authenticate, (req, res) => {
    db.all(`SELECT id, name, email, role FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.json(rows);
    });
});

// --- TASK ROUTES ---

// Create Task: POST /api/tasks
app.post('/api/tasks', authenticate, (req, res) => {
    const { title, dueDate, projectId, assignedTo } = req.body;
    
    // Validations
    if (!title || !projectId) return res.status(400).json({ message: 'Title and Project ID are required.' });

    db.run(`INSERT INTO tasks (title, dueDate, projectId, assignedTo, status) VALUES (?, ?, ?, ?, 'Pending')`,
        [title, dueDate, projectId, assignedTo],
        function(err) {
            if (err) return res.status(500).json({ message: 'Database error.' });
            res.status(201).json({ id: this.lastID, title, dueDate, projectId, assignedTo, status: 'Pending' });
        }
    );
});

// Get Tasks: GET /api/tasks
app.get('/api/tasks', authenticate, (req, res) => {
    db.all(`SELECT * FROM tasks`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error.' });
        res.json(rows);
    });
});

// Update Task Status: PATCH /api/tasks/:id
app.patch('/api/tasks/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }

    db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) return res.status(500).json({ message: 'Database error.' });
        if (this.changes === 0) return res.status(404).json({ message: 'Task not found.' });
        res.json({ message: 'Task updated', id, status });
    });
});

// Delete Project: DELETE /api/projects/:id (Admin only)
app.delete('/api/projects/:id', authenticate, (req, res) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    const { id } = req.params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID.' });
    }

    console.log(`Attempting to delete project with ID: ${projectId}`);

    db.run(`DELETE FROM projects WHERE id = ?`, [projectId], function(err) {
        if (err) {
            console.error('Delete Project Error:', err);
            return res.status(500).json({ message: 'Database error.' });
        }
        
        if (this.changes === 0) {
            console.warn(`Project with ID ${projectId} not found or no changes made.`);
            return res.status(404).json({ message: 'Project not found.' });
        }

        console.log(`Project ${projectId} deleted. Now deleting associated tasks...`);

        // Also delete tasks associated with this project
        db.run(`DELETE FROM tasks WHERE projectId = ?`, [projectId], (err) => {
            if (err) console.error('Error deleting tasks for project:', projectId);
            res.json({ message: 'Project and associated tasks deleted successfully.' });
        });
    });
});

// Catch-all to serve index.html for frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
