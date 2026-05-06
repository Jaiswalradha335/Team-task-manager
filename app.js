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
        fetchData();
        showTab('dashboard');
    } else {
        showPage('auth-section');
    }

    // Setup Event Listeners
    setupFormListeners();
}

async function fetchData() {
    await Promise.all([
        fetchProjects(),
        fetchTasks(),
        fetchUsers()
    ]);
    renderDashboard();
}

function setupFormListeners() {
    // Login
    document.getElementById('form-login').addEventListener('submit', async (e) => {
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
            showToast('Network error', 'error');
        }
    });

    // Signup
    document.getElementById('form-signup').addEventListener('submit', async (e) => {
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
            showToast('Network error', 'error');
        }
    });

    // Create Project
    document.getElementById('form-project').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('proj-name').value;
        const description = document.getElementById('proj-desc').value;
        const members = document.getElementById('proj-members').value;

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
                showToast('Project launched!', 'success');
                closeModal('modal-project');
                e.target.reset();
                fetchData();
            } else {
                const data = await res.json();
                showToast(data.message || 'Failed to create project', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });

    // Create Task
    document.getElementById('form-task').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title-input').value;
        const dueDate = document.getElementById('task-date').value;
        const projectId = document.getElementById('task-project-select').value;
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
                fetchData();
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
        allProjects = await res.json();
        populateProjectDropdowns();
    } catch (err) {
        showToast('Error fetching projects', 'error');
    }
}

async function fetchTasks() {
    try {
        const res = await fetch(`${API}/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allTasks = await res.json();
    } catch (err) {
        showToast('Error fetching tasks', 'error');
    }
}

let allUsers = [];
async function fetchUsers() {
    try {
        const res = await fetch(`${API}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allUsers = await res.json();
        renderTeamList(allUsers);
        populateMemberDropdown();
    } catch (err) {
        showToast('Error fetching users', 'error');
    }
}

function populateMemberDropdown() {
    const select = document.getElementById('select-new-member');
    if (!select) return;
    select.innerHTML = '<option value="">Select Member</option>';
    allUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = `${u.name} (${u.role})`;
        select.appendChild(opt);
    });
}

function populateProjectDropdowns() {
    const selects = [document.getElementById('task-project-select'), document.getElementById('task-filter-project')];
    selects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = select.id === 'task-filter-project' ? '<option value="all">All Projects</option>' : '';
        allProjects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
        select.value = currentValue || select.firstChild?.value;
    });
}

// --- Rendering Logic ---

function renderDashboard() {
    const now = new Date();
    now.setHours(0,0,0,0);

    // Calculate Stats
    const stats = {
        totalProjects: allProjects.length,
        activeProjects: allProjects.filter(p => p.status !== 'Completed').length,
        completedProjects: allProjects.filter(p => p.status === 'Completed').length,
        tasks: allTasks.length,
        completedTasks: allTasks.filter(t => t.status === 'Completed').length,
        progressTasks: allTasks.filter(t => t.status === 'In Progress').length,
        pendingTasks: allTasks.filter(t => t.status === 'Pending').length,
        overdueTasks: allTasks.filter(t => {
            const d = new Date(t.dueDate);
            d.setHours(0,0,0,0);
            return d <= now && t.status !== 'Completed';
        }).length
    };

    // Update UI Stats
    document.getElementById('stat-projects').textContent = stats.activeProjects;
    document.getElementById('stat-proj-sub').textContent = `${stats.completedProjects} archives`;
    document.getElementById('stat-tasks').textContent = stats.tasks;
    document.getElementById('stat-task-sub').textContent = `${stats.completedTasks} completed`;
    document.getElementById('stat-progress').textContent = stats.progressTasks;
    document.getElementById('stat-overdue').textContent = stats.overdueTasks;

    // Render Recent Activity
    const activityList = document.getElementById('recent-activity-list');
    activityList.innerHTML = '';
    const recentTasks = [...allTasks].sort((a,b) => b.id - a.id).slice(0, 5);
    
    recentTasks.forEach(task => {
        const project = allProjects.find(p => p.id == task.projectId);
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0,0,0,0);
        const isOverdue = dueDate <= now && task.status !== 'Completed';
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <h5>${task.title}</h5>
                <p>${project ? project.name : 'Unknown Project'} • ${task.assignedTo || 'Unassigned'}</p>
            </div>
            <span class="badge ${isOverdue ? 'badge-overdue' : 'badge-pending'}">${isOverdue ? 'overdue' : task.status.toLowerCase()}</span>
        `;
        activityList.appendChild(item);
    });

    // Update Chart
    const total = stats.tasks || 1; // avoid divide by zero
    const pComp = (stats.completedTasks / total) * 100;
    const pProg = (stats.progressTasks / total) * 100;
    const pPend = (stats.pendingTasks / total) * 100;
    const pOver = (stats.overdueTasks / total) * 100;

    document.getElementById('chart-total-count').textContent = stats.tasks;
    document.getElementById('status-donut').style.background = `conic-gradient(
        var(--success) 0% ${pComp}%,
        var(--primary) ${pComp}% ${pComp + pProg}%,
        var(--warning) ${pComp + pProg}% ${pComp + pProg + pPend}%,
        var(--danger) ${pComp + pProg + pPend}% 100%
    )`;

    renderProjectsPage();
    renderTasksPage();
}

function renderProjectsPage() {
    const list = document.getElementById('page-projects-list');
    list.innerHTML = '';
    
    allProjects.forEach(project => {
        const pTasks = allTasks.filter(t => t.projectId == project.id);
        const completed = pTasks.filter(t => t.status === 'Completed').length;
        const progress = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0;
        const isProjectCompleted = project.status === 'Completed';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.style.opacity = isProjectCompleted ? '0.8' : '1';
        card.onclick = () => openProjectDetails(project.id);
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem;">
                <h3 style="font-size: 1.125rem; font-weight: 700;">${project.name} ${isProjectCompleted ? '✅' : ''}</h3>
                <span class="badge ${isProjectCompleted ? 'badge-success' : 'badge-pending'}">${isProjectCompleted ? '100%' : progress + '%'}</span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem; min-height: 3em;">${project.description || 'No description provided.'}</p>
            <div style="margin-bottom: 1.5rem;">
                <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; background: ${isProjectCompleted ? 'var(--success)' : 'var(--primary)'}; width: ${isProjectCompleted ? '100' : progress}%;"></div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="avatar-group" style="display:flex;">
                    <img src="https://i.pravatar.cc/150?u=${project.id}1" style="width:32px; height:32px; border-radius:50%; border:2px solid white;">
                    <img src="https://i.pravatar.cc/150?u=${project.id}2" style="width:32px; height:32px; border-radius:50%; border:2px solid white; margin-left:-8px;">
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted);">${completed}/${pTasks.length} Tasks</p>
            </div>
        `;
        list.appendChild(card);
    });
}

window.openProjectDetails = function(projectId) {
    const project = allProjects.find(p => p.id == projectId);
    if (!project) return;

    const pTasks = allTasks.filter(t => t.projectId == projectId);
    const completed = pTasks.filter(t => t.status === 'Completed').length;
    const progress = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0;
    const isProjectCompleted = project.status === 'Completed';

    const detailName = document.getElementById('detail-project-name');
    detailName.innerHTML = `${project.name} ${isProjectCompleted ? '✅' : ''}`;
    if (isProjectCompleted) detailName.style.color = 'var(--success)';
    else detailName.style.color = 'var(--text-main)';

    const descEl = document.getElementById('detail-project-desc');
    descEl.innerHTML = `
        <p style="margin-bottom: 1.5rem;">${project.description || 'No description provided.'}</p>
        <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 1rem;">
            <div style="height: 100%; background: ${isProjectCompleted ? 'var(--success)' : 'var(--primary)'}; width: ${isProjectCompleted ? '100' : progress}%; transition: width 0.5s ease;"></div>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2rem;">
            ${isProjectCompleted ? '100% COMPLETE' : progress + '% PROGRESS'} (${completed}/${pTasks.length} Tasks)
        </p>
    `;
    
    // Render Members
    const membersDiv = document.getElementById('detail-project-members');
    membersDiv.innerHTML = '';
    const membersList = project.members ? project.members.split(',') : [];
    membersList.forEach(m => {
        const badge = document.createElement('span');
        badge.className = 'badge badge-pending';
        badge.textContent = m.trim();
        membersDiv.appendChild(badge);
    });

    // Admin Add Member UI
    const adminSection = document.getElementById('admin-add-member-section');
    if (currentUser && currentUser.role === 'Admin') {
        adminSection.classList.remove('hidden');
        document.getElementById('btn-add-member').onclick = () => addMemberToProject(projectId);
        
        // Handle Complete Project Button
        const completeBtn = document.getElementById('btn-complete-project');
        if (project.status === 'Completed') {
            completeBtn.textContent = 'Project is Completed';
            completeBtn.disabled = true;
            completeBtn.style.opacity = '0.6';
        } else {
            completeBtn.textContent = 'Mark Project as Completed';
            completeBtn.disabled = false;
            completeBtn.style.opacity = '1';
            completeBtn.onclick = () => completeProject(projectId);
        }
    } else {
        adminSection.classList.add('hidden');
    }

    // Project Tasks
    const tasksDiv = document.getElementById('detail-project-tasks');
    tasksDiv.innerHTML = '';
    const pTasks = allTasks.filter(t => t.projectId == projectId);
    if (pTasks.length === 0) {
        tasksDiv.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No tasks yet.</p>';
    }
    pTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <h5>${task.title}</h5>
                <p>Status: ${task.status} • Due ${new Date(task.dueDate).toLocaleDateString()}</p>
            </div>
            <span class="badge ${task.status === 'Completed' ? 'badge-success' : 'badge-pending'}">${task.status}</span>
        `;
        tasksDiv.appendChild(item);
    });

    openModal('modal-project-details');
};

async function addMemberToProject(projectId) {
    const project = allProjects.find(p => p.id == projectId);
    const newMember = document.getElementById('select-new-member').value;
    if (!newMember) return showToast('Please select a member', 'error');

    let currentMembers = project.members ? project.members.split(',') : [];
    if (currentMembers.includes(newMember)) return showToast('Member already in project', 'error');
    
    currentMembers.push(newMember);
    const updatedMembers = currentMembers.join(',');

    try {
        const res = await fetch(`${API}/projects/${projectId}/members`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ members: updatedMembers })
        });
        
        if (res.ok) {
            showToast('Member added!', 'success');
            await fetchProjects();
            openProjectDetails(projectId); // Refresh view
        } else {
            showToast('Failed to add member', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

async function completeProject(projectId) {
    if (!confirm('Are you sure you want to mark this project and all its tasks as completed?')) return;

    try {
        const res = await fetch(`${API}/projects/${projectId}/complete`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            showToast('Project completed successfully!', 'success');
            closeModal('modal-project-details');
            fetchData(); // This updates dashboard and projects list instantly
        } else {
            showToast('Failed to complete project', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

function renderTasksPage(filterStatus = null) {
    const columns = {
        'Pending': document.getElementById('page-tasks-pending'),
        'In Progress': document.getElementById('page-tasks-progress'),
        'Completed': document.getElementById('page-tasks-completed')
    };

    Object.values(columns).forEach(col => col.innerHTML = '');

    allTasks.forEach(task => {
        if (filterStatus && task.status !== filterStatus && filterStatus !== 'Overdue') return;
        
        // Handle Overdue special filter
        if (filterStatus === 'Overdue') {
            const d = new Date(task.dueDate);
            d.setHours(0,0,0,0);
            const now = new Date();
            now.setHours(0,0,0,0);
            if (!(d <= now && task.status !== 'Completed')) return;
        }

        const item = document.createElement('div');
        item.className = 'activity-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';
        item.style.gap = '0.75rem';
        item.style.cursor = 'pointer';
        item.onclick = () => cycleTaskStatus(task.id, task.status);

        item.innerHTML = `
            <div style="width:100%; display:flex; justify-content:space-between;">
                <h5 style="font-size: 0.9375rem;">${task.title}</h5>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Due ${new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <img src="https://i.pravatar.cc/150?u=${task.id}" style="width:20px; height:20px; border-radius:50%;">
                <span style="font-size: 0.75rem; color: var(--text-muted);">${task.assignedTo || 'Unassigned'}</span>
            </div>
        `;

        if (columns[task.status]) columns[task.status].appendChild(item);
    });
}

function renderTeamList(users) {
    const list = document.getElementById('page-team-list');
    list.innerHTML = '';
    
    const progressList = document.getElementById('member-progress-list');
    if (progressList) progressList.innerHTML = '';

    const isAdmin = currentUser && currentUser.role === 'Admin';
    const progressSection = document.getElementById('admin-progress-section');
    if (progressSection) progressSection.classList.toggle('hidden', !isAdmin);

    users.forEach(user => {
        // Calculate user performance
        const userTasks = allTasks.filter(t => t.assignedTo === user.name);
        const completed = userTasks.filter(t => t.status === 'Completed').length;
        const total = userTasks.length;
        const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Render standard card
        const card = document.createElement('div');
        card.className = 'card';
        card.style.textAlign = 'center';
        card.innerHTML = `
            <img src="https://i.pravatar.cc/150?u=${user.id}" class="avatar" style="width:80px; height:80px; margin-bottom:1rem;">
            <h4 style="margin-bottom:0.25rem;">${user.name}</h4>
            <p style="color: var(--text-muted); font-size:0.875rem; margin-bottom:1rem;">${user.email}</p>
            <span class="badge ${user.role === 'Admin' ? 'badge-success' : 'badge-pending'}" style="text-transform: capitalize;">${user.role}</span>
        `;
        list.appendChild(card);

        // Render progress row for admin
        if (isAdmin && progressList) {
            const row = document.createElement('div');
            row.className = 'card';
            row.style.marginBottom = '1rem';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        <img src="https://i.pravatar.cc/150?u=${user.id}" style="width:40px; height:40px; border-radius:50%;">
                        <div>
                            <h5 style="margin:0;">${user.name}</h5>
                            <p style="font-size:0.75rem; color: var(--text-muted); margin:0;">${user.role}</p>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:700; color: var(--primary);">${ratio}% Success Rate</span>
                        <p style="font-size:0.75rem; color: var(--text-muted); margin:0;">${completed}/${total} Tasks Completed</p>
                    </div>
                </div>
                <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; background: var(--success); width: ${ratio}%; transition: width 0.5s ease;"></div>
                </div>
            `;
            progressList.appendChild(row);
        }
    });
}

async function cycleTaskStatus(taskId, currentStatus) {
    const cycle = ['Pending', 'In Progress', 'Completed'];
    const next = cycle[(cycle.indexOf(currentStatus) + 1) % cycle.length];
    
    try {
        const res = await fetch(`${API}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: next })
        });
        if (res.ok) fetchData();
    } catch (err) {
        showToast('Error updating task', 'error');
    }
}

// --- UI Helpers ---

window.showTab = function(tabName, filter = null) {
    // Scroll to top
    window.scrollTo(0,0);

    const views = ['dashboard', 'projects', 'tasks', 'team', 'calendar', 'settings'];
    views.forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        if (viewEl) viewEl.classList.add('hidden');
        const navEl = document.getElementById(`nav-${v}`);
        if (navEl) navEl.classList.remove('active');
    });

    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    document.getElementById('active-tab-title').textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);

    if (tabName === 'tasks') {
        renderTasksPage(filter);
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    document.getElementById('user-name-top').textContent = currentUser.name;
    document.getElementById('user-role-top').textContent = currentUser.role === 'Admin' ? 'Administrator' : 'Team Member';
    document.getElementById('user-name-side').textContent = currentUser.name;
    document.getElementById('user-role-side').textContent = currentUser.role;
    document.getElementById('welcome-name').textContent = currentUser.name.split(' ')[0];
    
    const avatarUrl = `https://i.pravatar.cc/150?u=${currentUser.id}`;
    document.getElementById('sidebar-avatar').src = avatarUrl;
    document.getElementById('top-avatar').src = avatarUrl;
}

window.toggleAuth = (isLogin) => {
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
};

window.logout = () => {
    localStorage.clear();
    location.reload();
};

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

function showPage(id) {
    document.getElementById('auth-section').classList.toggle('hidden', id !== 'auth-section');
    document.getElementById('app-section').classList.toggle('hidden', id !== 'app-section');
}

function saveAuth(t, u) {
    token = t;
    currentUser = u;
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
}

function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
