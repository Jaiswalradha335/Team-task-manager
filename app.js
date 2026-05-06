const API = "/api";

// --- State Management ---
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let token = localStorage.getItem('token') || null;
let allTasks = [];
let allProjects = [];
let currentCalendarDate = new Date();

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
    renderProjectsPage();
    renderTasksPage();
    renderTeamList(allUsers);
    
    // Role based restrictions on Dashboard
    const isAdmin = currentUser && currentUser.role === 'Admin';
    const quickActions = document.querySelectorAll('.dashboard-column button.btn');
    quickActions.forEach(btn => {
        if (!isAdmin) {
            btn.style.display = 'none';
        }
    });
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
            const errorEl = document.getElementById('signup-error');
            errorEl.classList.add('hidden');
            
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
                errorEl.textContent = data.message || 'Signup failed';
                errorEl.classList.remove('hidden');
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
                document.getElementById('proj-members').value = '';
                document.getElementById('project-members-container').innerHTML = '';
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
        const assignedTo = document.getElementById('task-assignee-select').value;

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
    const selects = [
        document.getElementById('select-new-member'),
        document.getElementById('select-project-member'),
        document.getElementById('task-assignee-select')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Select Member</option>';
        allUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.name;
            opt.textContent = `${u.name} (${u.role})`;
            select.appendChild(opt);
        });
    });

    // Special logic for adding members to a new project
    const projMemberSelect = document.getElementById('select-project-member');
    if (projMemberSelect) {
        projMemberSelect.onchange = (e) => {
            const name = e.target.value;
            if (!name) return;
            
            const hiddenInput = document.getElementById('proj-members');
            let current = hiddenInput.value ? hiddenInput.value.split(',') : [];
            
            if (!current.includes(name)) {
                current.push(name);
                hiddenInput.value = current.join(',');
                renderProjectMemberBadges(current);
            }
            e.target.value = ''; // Reset
        };
    }
}

function renderProjectMemberBadges(members) {
    const container = document.getElementById('project-members-container');
    container.innerHTML = '';
    members.forEach(m => {
        const badge = document.createElement('span');
        badge.className = 'badge badge-pending';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.5rem';
        badge.innerHTML = `${m} <span style="cursor:pointer; font-weight:800;" onclick="removeMemberFromNewProject('${m}')">✕</span>`;
        container.appendChild(badge);
    });
}

window.removeMemberFromNewProject = function(name) {
    const hiddenInput = document.getElementById('proj-members');
    let current = hiddenInput.value.split(',');
    current = current.filter(m => m !== name);
    hiddenInput.value = current.join(',');
    renderProjectMemberBadges(current);
};

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

    // Render Recent Activity (Showing Ongoing Projects)
    const activityList = document.getElementById('recent-activity-list');
    activityList.innerHTML = '';
    const ongoingProjects = [...allProjects].filter(p => p.status !== 'Completed').sort((a,b) => b.id - a.id).slice(0, 5);
    
    ongoingProjects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.style.cursor = 'pointer';
        item.onclick = () => openProjectDetails(project.id);
        
        const membersCount = project.members ? project.members.split(',').length : 0;
        
        item.innerHTML = `
            <div class="activity-info">
                <h5>${project.name}</h5>
                <p>${membersCount} Team Members • ${project.status}</p>
            </div>
            <span class="badge badge-pending">ongoing</span>
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
                <h3 style="font-size: 1.125rem; font-weight: 700;">#${project.id} ${project.name} ${isProjectCompleted ? '✅' : ''}</h3>
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

    // Hide Create button for members
    const createBtn = document.querySelector('#view-projects .btn-primary');
    if (createBtn) {
        createBtn.style.display = (currentUser && currentUser.role === 'Admin') ? 'flex' : 'none';
    }
}

window.openProjectDetails = function(projectId) {
    const project = allProjects.find(p => p.id == projectId);
    if (!project) return;

    const pTasks = allTasks.filter(t => t.projectId == projectId);
    const completed = pTasks.filter(t => t.status === 'Completed').length;
    const progress = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0;
    const isProjectCompleted = project.status === 'Completed';

    const detailName = document.getElementById('detail-project-name');
    detailName.innerHTML = `#${project.id} ${project.name} ${isProjectCompleted ? '✅' : ''}`;
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
    const isAdmin = currentUser && currentUser.role === 'Admin';

    membersList.forEach(m => {
        const badge = document.createElement('div');
        badge.className = 'badge badge-pending';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.5rem';
        badge.style.padding = '0.5rem 0.75rem';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = m.trim();
        badge.appendChild(nameSpan);

        if (isAdmin) {
            const removeIcon = document.createElement('span');
            removeIcon.innerHTML = '✕';
            removeIcon.style.cursor = 'pointer';
            removeIcon.style.fontWeight = '800';
            removeIcon.style.color = 'var(--danger)';
            removeIcon.onclick = (e) => {
                e.stopPropagation();
                removeMemberFromProject(projectId, m.trim());
            };
            badge.appendChild(removeIcon);
        }
        
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

        const deleteBtn = document.getElementById('btn-delete-project');
        if (deleteBtn) {
            deleteBtn.onclick = () => deleteProject(projectId);
        }
    } else {
        adminSection.classList.add('hidden');
    }

    // Project Tasks
    const tasksDiv = document.getElementById('detail-project-tasks');
    tasksDiv.innerHTML = '';
    // pTasks is already declared above
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

    const btnDelete = document.getElementById('btn-delete-project');
    if (btnDelete) {
        btnDelete.onclick = () => deleteProject(projectId);
    }
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

async function deleteProject(projectId) {
    console.log('Frontend attempting to delete project ID:', projectId);
    if (!confirm('Are you sure you want to delete this project and all its tasks? This action cannot be undone.')) return;

    try {
        const res = await fetch(`${API}/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('Delete Response Status:', res.status);
        
        if (res.ok) {
            const data = await res.json();
            console.log('Delete Success:', data);
            showToast('Project deleted successfully!', 'success');
            closeModal('modal-project-details');
            setTimeout(() => {
                location.reload();
            }, 500);
        } else {
            const data = await res.json();
            console.error('Delete Failed:', data);
            showToast(data.message || 'Failed to delete project', 'error');
        }
    } catch (err) {
        console.error('Delete Error:', err);
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
                <img src="${getAvatarUrl(task.assignedTo, task.id)}" style="width:20px; height:20px; border-radius:50%;">
                <span style="font-size: 0.75rem; color: var(--text-muted);">${task.assignedTo || 'Unassigned'}</span>
            </div>
        `;

        if (columns[task.status]) columns[task.status].appendChild(item);
    });

    // Hide Add Task button for members
    const addTaskBtn = document.querySelector('#view-tasks .btn-primary');
    if (addTaskBtn) {
        addTaskBtn.style.display = (currentUser && currentUser.role === 'Admin') ? 'flex' : 'none';
    }
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
        card.style.cursor = 'pointer';
        card.onclick = () => openMemberDetails(user);
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
    if (tabName === 'calendar') {
        renderCalendar();
    }
    if (tabName === 'settings') {
        renderSettings();
    }
}

function renderSettings() {
    const view = document.getElementById('view-settings');
    if (!view) return;
    
    const content = view.querySelector('.card');
    if (!content) return;

    content.innerHTML = `
        <div style="padding: 1.5rem 0; border-bottom: 1px solid var(--border); display:flex; align-items:center; gap: 2rem;">
            <img src="https://i.pravatar.cc/150?u=${currentUser.id}" style="width:100px; height:100px; border-radius:50%; border: 4px solid var(--primary-light);">
            <div>
                <h3 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">${currentUser.name}</h3>
                <p style="color: var(--text-muted);">${currentUser.email} • <span class="badge badge-pending" style="text-transform: capitalize;">${currentUser.role}</span></p>
            </div>
        </div>
        <div style="padding: 2.5rem 0;">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="card" style="padding: 1.5rem; background: #f8fafc;">
                    <h5 style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Member Since</h5>
                    <p style="font-weight: 700;">Jan 2024</p>
                </div>
                <div class="card" style="padding: 1.5rem; background: #f8fafc;">
                    <h5 style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Security Status</h5>
                    <p style="font-weight: 700; color: var(--success);">Verified Account</p>
                </div>
            </div>
            <button class="btn btn-primary" onclick="showToast('Profile editing coming soon!', 'info')">Edit Profile</button>
        </div>
    `;
}

// --- Calendar Logic ---
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('calendar-month-year');
    if (!grid || !monthYearLabel) return;

    grid.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="day-number">${prevMonthDays - i}</span>`;
        grid.appendChild(dayDiv);
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
        dayDiv.className = `calendar-day ${isToday ? 'today' : ''}`;
        dayDiv.innerHTML = `<span class="day-number">${i}</span>`;

        // Check for tasks on this day
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayTasks = allTasks.filter(t => t.dueDate.startsWith(dateStr));

        dayTasks.forEach(task => {
            const tag = document.createElement('div');
            tag.className = `calendar-task-tag ${task.status === 'Completed' ? 'completed' : ''}`;
            tag.textContent = task.title;
            dayDiv.appendChild(tag);
        });

        grid.appendChild(dayDiv);
    }

    // Next month days (to fill 42 cells)
    const totalCells = 42;
    const remainingCells = totalCells - grid.children.length;
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="day-number">${i}</span>`;
        grid.appendChild(dayDiv);
    }
}

window.changeMonth = function(dir) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + dir);
    renderCalendar();
};

window.openMemberDetails = function(user) {
    document.getElementById('member-detail-name').textContent = user.name;
    document.getElementById('member-detail-email').textContent = user.email;
    document.getElementById('member-detail-role').textContent = user.role;
    document.getElementById('member-detail-avatar').src = getAvatarUrl(user.name, user.id);
    
    const userProjects = allProjects.filter(p => p.members && p.members.includes(user.name));
    const userTasks = allTasks.filter(t => t.assignedTo === user.name);
    
    document.getElementById('member-stat-projects').textContent = userProjects.length;
    document.getElementById('member-stat-tasks').textContent = userTasks.length;
    
    const activityDiv = document.getElementById('member-detail-activity');
    activityDiv.innerHTML = '';
    
    if (userProjects.length === 0 && userTasks.length === 0) {
        activityDiv.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No active projects or tasks.</p>';
    }

    userProjects.forEach(p => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <h5>Project: ${p.name}</h5>
                <p>Status: ${p.status}</p>
            </div>
            <span class="badge badge-success">Assigned</span>
        `;
        activityDiv.appendChild(item);
    });

    userTasks.forEach(t => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <h5>Task: ${t.title}</h5>
                <p>Due: ${new Date(t.dueDate).toLocaleDateString()}</p>
            </div>
            <span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-pending'}">${t.status}</span>
        `;
        activityDiv.appendChild(item);
    });

    openModal('modal-member-details');
};

async function removeMemberFromProject(projectId, memberName) {
    if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;

    const project = allProjects.find(p => p.id == projectId);
    let currentMembers = project.members.split(',').map(m => m.trim());
    const updatedMembers = currentMembers.filter(m => m !== memberName).join(',');

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
            showToast('Member removed', 'success');
            await fetchProjects();
            openProjectDetails(projectId);
        } else {
            showToast('Failed to remove member', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    document.getElementById('user-name-top').textContent = currentUser.name;
    document.getElementById('user-role-top').textContent = currentUser.role === 'Admin' ? 'Administrator' : 'Team Member';
    document.getElementById('user-name-side').textContent = currentUser.name;
    document.getElementById('user-role-side').textContent = currentUser.role;
    document.getElementById('welcome-name').textContent = currentUser.name.split(' ')[0];
    
    const avatarUrl = getAvatarUrl(currentUser.name, currentUser.id);
    document.getElementById('sidebar-avatar').src = avatarUrl;
    document.getElementById('top-avatar').src = avatarUrl;
}

function getAvatarUrl(name, id) {
    if (!name) return `https://i.pravatar.cc/150?u=${id}`;
    
    const femaleNames = ['radha', 'maya', 'priya', 'anita', 'sneha', 'neha', 'pooja', 'jaiswal', 'rani'];
    const isFemale = femaleNames.some(fn => name.toLowerCase().includes(fn));
    
    if (isFemale) {
        // Use a consistent female avatar for female names
        return `https://i.pravatar.cc/150?u=female${id % 10}`;
    }
    return `https://i.pravatar.cc/150?u=${id}`;
}

window.toggleAuth = (isLogin) => {
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
};

window.logout = () => {
    localStorage.clear();
    location.reload();
};

window.openModal = (id) => {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};
window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = 'auto';
};

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
