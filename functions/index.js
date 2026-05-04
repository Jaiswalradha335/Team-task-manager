const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

admin.initializeApp();
const db = admin.firestore();
const app = express();
const SECRET_KEY = 'your_super_secret_key';

app.use(cors({ origin: true }));
app.use(express.json());

// Authentication Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token' });
    }
};

// --- AUTH ROUTES ---

app.post('/auth/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();
    
    if (doc.exists()) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await userRef.set({ name, email, password: hashedPassword, role });
    res.status(201).json({ message: 'User created' });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();
    
    if (!doc.exists()) return res.status(401).json({ message: 'Invalid credentials' });
    
    const user = doc.data();
    if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: email, name: user.name, role: user.role }, SECRET_KEY);
    res.json({ token, user: { name: user.name, role: user.role } });
});

// --- PROJECT ROUTES ---

app.post('/projects', authenticate, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Admins only' });
    const projectRef = db.collection('projects').doc();
    const project = { ...req.body, id: projectRef.id, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    await projectRef.set(project);
    res.status(201).json(project);
});

// --- TASK ROUTES ---

app.get('/tasks', authenticate, async (req, res) => {
    const snapshot = await db.collection('tasks').get();
    const tasks = [];
    snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
    res.json(tasks);
});

app.post('/tasks', authenticate, async (req, res) => {
    const taskRef = db.collection('tasks').doc();
    const task = { 
        ...req.body, 
        id: taskRef.id, 
        status: 'Pending', 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
    };
    await taskRef.set(task);
    res.status(201).json(task);
});

app.patch('/tasks/:id', authenticate, async (req, res) => {
    const taskRef = db.collection('tasks').doc(req.params.id);
    await taskRef.update({ status: req.body.status });
    res.json({ message: 'Updated' });
});

exports.api = functions.https.onRequest(app);
