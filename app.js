const API = "/api";

// --- State Management ---
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let token = localStorage.getItem('token') || null;
let allTasks = [];
let allProjects = [];

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    if (token) {
        showPage('app-section');
        updateUserInfo();
        fetchTasks();
        fetchProjects();
        fetchUsers();
        showTab('dashboard');
    } else {
        showPage('auth-section');
    }


    // Setup Event Listeners
    setupFormListeners();
}

function setupFormListeners() {
    // Login
    const loginForm = document.getElementById('form-login');
    // Remove old listeners to prevent duplicates if init is called again
    const newLoginForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);

    newLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                saveAuth(data.token, data.user);
                showToast('Login successful!', 'success');
                init();
            } else {
                showToast(data.message || 'Login failed', 'error');
            }
        } catch (err) {
            showToast('Network error - Is the server running?', 'error');
        }
    });

    // Signup
    const signupForm = document.getElementById('form-signup');
    const newSignupForm = signupForm.cloneNode(true);
    signupForm.parentNode.replaceChild(newSignupForm, signupForm);

    newSignupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const role = document.getElementById('signup-role').value;

        try {
            const res = await fetch(`${API}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            const data = await res.json();

            if (res.ok) {
                showToast('Account created! Please login.', 'success');
                toggleAuth(true);
            } else {
                showToast(data.message || 'Signup failed', 'error');
            }
        } catch (err) {
            showToast('Network error - Is the server running?', 'error');
        }
    });

    // Create Project
    const projectForm = document.getElementById('form-project');
    const newProjectForm = projectForm.cloneNode(true);
    projectForm.parentNode.replaceChild(newProjectForm, projectForm);

    newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('proj-name').value;
        const description = document.getElementById('proj-desc').value;
        const members = document.getElementById('proj-members').value.split(',').map(s => s.trim());

        try {
            const res = await fetch(`${API}/projects`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description, members })
            });
            
            if (res.ok) {
                showToast('Project created successfully!', 'success');
                closeModal('modal-project');
                e.target.reset();
                fetchProjects(); // Refresh project list
            } else {
                const data = await res.json();
                showToast(data.message || 'Failed to create project', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });

    // Create Task
    const taskForm = document.getElementById('form-task');
    const newTaskForm = taskForm.cloneNode(true);
    taskForm.parentNode.replaceChild(newTaskForm, taskForm);

    newTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title-input').value;
        const dueDate = document.getElementById('task-date').value;
        const projectId = document.getElementById('task-project').value;
        const assignedTo = document.getElementById('task-assignee').value;

        try {
            const res = await fetch(`${API}/tasks`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, dueDate, projectId, assignedTo })
            });
            
            if (res.ok) {
                showToast('Task created!', 'success');
                closeModal('modal-task');
                e.target.reset();
                fetchTasks(); // Refresh list
            } else {
                const data = await res.json();
                showToast(data.message || 'Failed to create task', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });
}

// --- API Calls ---

async function fetchProjects() {
    try {
        const res = await fetch(`${API}/projects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const projects = await res.json();
        
        if (res.ok) {
            allProjects = projects;
            renderProjects(projects);
        } else {
            showToast('Failed to fetch projects', 'error');
        }
    } catch (err) {
        showToast('Network error fetching projects', 'error');
    }
}

async function fetchTasks() {
    try {
        const res = await fetch(`${API}/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tasks = await res.json();
        
        if (res.ok) {
            allTasks = tasks;
            renderTasks(tasks);
            if (allProjects.length > 0) renderProjects(allProjects); // Re-render to update actual project progress
        } else {
            showToast('Failed to fetch tasks', 'error');
        }
    } catch (err) {
        showToast('Network error fetching tasks', 'error');
    }
}

async function fetchUsers() {
    try {
        const res = await fetch(`${API}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await res.json();
        
        if (res.ok) {
            renderUsers(users);
        } else {
            showToast('Failed to fetch team members', 'error');
        }
    } catch (err) {
        showToast('Network error fetching team members', 'error');
    }
}

window.updateTaskStatus = async function(taskId, currentStatus) {
    const statusCycle = ['Pending', 'In Progress', 'Completed'];
    const nextIndex = (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];

    try {
        const res = await fetch(`${API}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: nextStatus })
        });

        if (res.ok) {
            fetchTasks(); // Refresh list
        }
    } catch (err) {
        showToast('Error updating status', 'error');
    }
}

window.completeProject = async function(projectId) {
    if (!confirm('Mark all tasks in this project as completed?')) return;
    
    try {
        const res = await fetch(`${API}/projects/${projectId}/complete`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            showToast('Project completed!', 'success');
            fetchTasks(); // Refresh tasks and projects
        } else {
            const data = await res.json();
            showToast(data.message || 'Error completing project', 'error');
        }
    } catch (err) {
        showToast('Error completing project', 'error');
    }
}

// --- UI Logic ---

function renderProjects(projects) {
    const projectList = document.getElementById('project-list');
    const allProjectList = document.getElementById('all-projects-list');
    const pageProjectsList = document.getElementById('page-projects-list');
    
    projectList.innerHTML = '';
    if(allProjectList) allProjectList.innerHTML = '';
    if(pageProjectsList) pageProjectsList.innerHTML = '';
    
    document.getElementById('stat-projects').textContent = projects.length;
    document.getElementById('stat-proj-sub').textContent = projects.length + ' ongoing';

    // Helper to generate the card HTML
    const generateProjectCard = (project) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        // Calculate actual progress based on tasks with date-based logic
        const projectTasks = allTasks.filter(t => parseInt(t.projectId) === project.id || t.projectId === project.id.toString());
        const totalProjectTasks = projectTasks.length;
        const now = new Date();
        now.setHours(0,0,0,0);
        const completedProjectTasks = projectTasks.filter(t => {
            const d = new Date(t.dueDate);
            d.setHours(0,0,0,0);
            // Past date = auto-completed, or manually completed
            return t.status === 'Completed' || d < now;
        }).length;
        const progress = totalProjectTasks > 0 ? Math.round((completedProjectTasks / totalProjectTasks) * 100) : 0;
        
        item.innerHTML = `
            <div class="task-info" style="flex:1;">
                <div class="task-icon" style="background: var(--primary-light); border:none; width:36px; height:36px; border-radius:8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                </div>
                <div class="task-text" style="width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <h5>${project.name}</h5>
                    <p>${completedProjectTasks} of ${totalProjectTasks} tasks done</p>
                </div>
            </div>
            <div class="project-progress">
                <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%;"></div></div>
                <span class="progress-text">${progress}%</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem; min-width:60px;">
                <div class="avatar-group">
                    <img src="https://i.pravatar.cc/150?u=${project.id}1">
                    <img src="https://i.pravatar.cc/150?u=${project.id}2">
                    <div class="more">+2</div>
                </div>
                ${currentUser && currentUser.role === 'Admin' && progress < 100 ? 
                    `<button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size:0.75rem;" onclick="completeProject('${project.id}')">✓ Complete</button>` : ''}
            </div>
        `;
        return item;
    };

    // Render All Projects in Modal and Projects Page
    projects.forEach(project => {
        if(allProjectList) allProjectList.appendChild(generateProjectCard(project));
        if(pageProjectsList) pageProjectsList.appendChild(generateProjectCard(project));
    });

    // Render Top 3 in Dashboard
    const topProjects = projects.slice(0, 3);
    topProjects.forEach(project => {
        projectList.appendChild(generateProjectCard(project));
    });

    if (projects.length === 0) {
        projectList.innerHTML = '<p class="text-muted" style="padding: 1rem 0;">No projects found.</p>';
        if(allProjectList) allProjectList.innerHTML = '<p class="text-muted">No projects found.</p>';
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('task-list');
    const overdueList = document.getElementById('overdue-list');
    const pendingList = document.getElementById('page-tasks-pending');
    const progressList = document.getElementById('page-tasks-progress');
    const completedList = document.getElementById('page-tasks-completed');
    
    taskList.innerHTML = '';
    overdueList.innerHTML = '';
    if (pendingList) pendingList.innerHTML = '';
    if (progressList) progressList.innerHTML = '';
    if (completedList) completedList.innerHTML = '';

    const now = new Date();
    now.setHours(0,0,0,0); // Normalize to start of today
    
    let stats = { total: tasks.length, progress: 0, completed: 0, overdue: 0, pending: 0 };

    tasks.forEach(task => {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0,0,0,0); // Normalize task due date
        
        let isOverdue = false;

        // Apply automatic date rules requested by user
        if (dueDate < now) {
            // Past date: mark as completed
            task.status = 'Completed';
        } else if (dueDate.getTime() === now.getTime()) {
            // Today's date: show overdue
            if (task.status !== 'Completed') {
                isOverdue = true;
                // Force status to Pending if it's not already something else valid
                if(task.status !== 'In Progress') task.status = 'Pending';
            }
        } else {
            // Upcoming date: mark pending
            if (task.status !== 'Completed' && task.status !== 'In Progress') {
                task.status = 'Pending';
            }
        }
        
        if (task.status === 'In Progress') stats.progress++;
        else if (task.status === 'Completed') stats.completed++;
        else stats.pending++;
        
        if (isOverdue) stats.overdue++;

        const item = document.createElement('div');
        item.className = 'list-item';
        
        const statusClass = task.status === 'In Progress' ? 'progress' : task.status.toLowerCase();
        
        let iconHtml = '';
        if (task.status === 'Completed') {
            iconHtml = `<div class="task-icon completed" onclick="updateTaskStatus('${task.id}', '${task.status}')" style="cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"></path></svg></div>`;
        } else if (isOverdue) {
            iconHtml = `<div class="task-icon overdue" onclick="updateTaskStatus('${task.id}', '${task.status}')" style="cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`;
        } else {
            iconHtml = `<div class="task-icon" onclick="updateTaskStatus('${task.id}', '${task.status}')" style="cursor:pointer;"></div>`;
        }

        item.innerHTML = `
            <div class="task-info">
                ${iconHtml}
                <div class="task-text">
                    <h5>${task.title}</h5>
                    <p>Project ID: ${task.projectId}</p>
                </div>
            </div>
            <div class="task-meta" style="display:flex; align-items:center; gap:0.5rem;">
                ${isOverdue ? '<span class="badge overdue">Overdue</span>' : ''}
                <span class="badge ${statusClass}" style="cursor:pointer;" onclick="updateTaskStatus('${task.id}', '${task.status}')">${task.status}</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">Due: ${new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </div>
        `;

        if (isOverdue) {
            overdueList.appendChild(item);
        } else {
            taskList.appendChild(item);
        }

        // Add to tasks page columns
        const clonedItem = item.cloneNode(true);
        if (task.status === 'Completed' && completedList) {
            completedList.appendChild(clonedItem);
        } else if (task.status === 'In Progress' && progressList) {
            progressList.appendChild(clonedItem);
        } else if (task.status === 'Pending' && pendingList) {
            pendingList.appendChild(clonedItem);
        }
    });

    // Update Top Stat Cards
    document.getElementById('stat-tasks').textContent = stats.total;
    document.getElementById('stat-task-sub').textContent = stats.completed + ' completed';
    
    document.getElementById('stat-progress').textContent = stats.progress;
    document.getElementById('stat-prog-sub').textContent = stats.total > 0 ? Math.round((stats.progress/stats.total)*100) + '% of tasks' : '0% of tasks';
    
    document.getElementById('stat-overdue').textContent = stats.overdue;

    // Update Chart Legend
    document.getElementById('chart-total').textContent = stats.total;
    
    const pct = (val) => stats.total > 0 ? Math.round((val/stats.total)*100) : 0;
    
    document.getElementById('leg-completed').textContent = `${stats.completed} (${pct(stats.completed)}%)`;
    document.getElementById('leg-progress').textContent = `${stats.progress} (${pct(stats.progress)}%)`;
    document.getElementById('leg-pending').textContent = `${stats.pending} (${pct(stats.pending)}%)`;
    document.getElementById('leg-overdue').textContent = `${stats.overdue} (${pct(stats.overdue)}%)`;

    // Dynamic Donut Chart Gradient
    const pComp = pct(stats.completed);
    const pProg = pComp + pct(stats.progress);
    const pPend = pProg + pct(stats.pending);
    
    document.getElementById('donut-chart').style.background = `conic-gradient(
        var(--success) 0% ${pComp}%,
        var(--warning) ${pComp}% ${pProg}%,
        var(--primary) ${pProg}% ${pPend}%,
        var(--danger) ${pPend}% 100%
    )`;

    if (overdueList.innerHTML === '') overdueList.innerHTML = '<p class="text-muted" style="padding: 1rem 0;">No overdue tasks.</p>';
    if (taskList.innerHTML === '') taskList.innerHTML = '<p class="text-muted" style="padding: 1rem 0;">No tasks found.</p>';
}

function renderUsers(users) {
    const teamList = document.getElementById('page-team-list');
    if (!teamList) return;
    teamList.innerHTML = '';

    if (users.length === 0) {
        teamList.innerHTML = '<p class="text-muted">No team members found.</p>';
        return;
    }

    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'card list-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.textAlign = 'center';
        item.style.padding = '1.5rem';
        item.innerHTML = `
            <img src="https://i.pravatar.cc/150?u=${user.id}1" class="avatar" style="width:64px; height:64px; margin-bottom:1rem;">
            <h4 style="margin-bottom:0.25rem;">${user.name}</h4>
            <p class="text-muted" style="font-size:0.875rem; margin-bottom:0.5rem;">${user.email}</p>
            <span class="badge ${user.role === 'Admin' ? 'progress' : 'pending'}">${user.role}</span>
        `;
        teamList.appendChild(item);
    });
}

function updateUserInfo() {
    if (currentUser) {
        // Top Nav
        document.getElementById('user-name-top').textContent = currentUser.name;
        document.getElementById('user-role-top').textContent = currentUser.role;
        
        // Sidebar
        document.getElementById('user-name-side').textContent = currentUser.name;
        
        // Show project creation button for admins
        if (currentUser.role === 'Admin') {
            document.getElementById('btn-create-project').classList.remove('hidden');
            const pageBtn = document.getElementById('btn-create-project-page');
            if(pageBtn) pageBtn.classList.remove('hidden');
        } else {
            document.getElementById('btn-create-project').classList.add('hidden');
            const pageBtn = document.getElementById('btn-create-project-page');
            if(pageBtn) pageBtn.classList.add('hidden');
        }
    }
}

window.toggleAuth = function(isLogin) {
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
}

function showPage(pageId) {
    document.getElementById('auth-section').classList.toggle('hidden', pageId !== 'auth-section');
    document.getElementById('app-section').classList.toggle('hidden', pageId !== 'app-section');
}

window.showTab = function(tabName) {
    // Hide all views
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-projects').classList.add('hidden');
    document.getElementById('view-tasks').classList.add('hidden');
    document.getElementById('view-team').classList.add('hidden');

    // Remove active class from all nav items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));

    // Show selected view and activate nav item
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    document.getElementById(`nav-${tabName}`).classList.add('active');

    // Update top nav title based on tab
    const titleMap = {
        'dashboard': 'Dashboard',
        'projects': 'Projects',
        'tasks': 'Task Board',
        'team': 'Team Members'
    };
    document.querySelector('.nav-title').textContent = titleMap[tabName];
}

function saveAuth(newToken, user) {
    token = newToken;
    currentUser = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
}

window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.reload();
}

window.openModal = function(id) {
    document.getElementById(id).classList.remove('hidden');
}

window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
