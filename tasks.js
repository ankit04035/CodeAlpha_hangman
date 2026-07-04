/* ==========================================================================
   Aether Study Planner - Tasks Module (To-Do List Manager)
   ========================================================================== */

(function() {
    let currentFilter = 'all';

    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskTagSelect = document.getElementById('task-tag');
    const taskPrioritySelect = document.getElementById('task-priority');
    const estPomoInput = document.getElementById('task-est-pomodoros');
    
    const pomoDecBtn = document.getElementById('pomo-dec');
    const pomoIncBtn = document.getElementById('pomo-inc');
    
    const activeTasksContainer = document.getElementById('active-task-list');
    const completedTasksContainer = document.getElementById('completed-task-list');
    
    const activeCountBadge = document.getElementById('active-tasks-count');
    const completedCountBadge = document.getElementById('completed-tasks-count');
    
    const filterPills = document.querySelectorAll('.filter-pill');

    // Setup Pomodoro Count Picker Buttons in Form
    pomoDecBtn.addEventListener('click', () => {
        let val = parseInt(estPomoInput.value, 10);
        if (val > 1) estPomoInput.value = val - 1;
    });

    pomoIncBtn.addEventListener('click', () => {
        let val = parseInt(estPomoInput.value, 10);
        if (val < 10) estPomoInput.value = val + 1;
    });

    // Form submission
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = taskTitleInput.value.trim();
        const tag = taskTagSelect.value;
        const priority = taskPrioritySelect.value;
        const estPomodoros = parseInt(estPomoInput.value, 10) || 1;
        
        if (!title) return;
        
        const newTask = {
            id: 'task_' + Date.now(),
            title: title,
            tag: tag,
            priority: priority,
            estPomodoros: estPomodoros,
            completedPomodoros: 0,
            completed: false
        };
        
        window.AetherState.tasks.push(newTask);
        window.saveState();
        
        // Reset Form
        taskTitleInput.value = '';
        taskTagSelect.selectedIndex = 0;
        taskPrioritySelect.value = 'Medium';
        estPomoInput.value = 2;
        
        renderTasks();
        if (window.refreshPomodoroTaskSelect) {
            window.refreshPomodoroTaskSelect();
        }
    });

    // Setup Filters
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.getAttribute('data-filter');
            renderTasks();
        });
    });

    // Toggle complete task
    window.toggleTaskComplete = function(taskId) {
        const task = window.AetherState.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            window.saveState();
            renderTasks();
            if (window.refreshPomodoroTaskSelect) {
                window.refreshPomodoroTaskSelect();
            }
        }
    };

    // Increment completed pomodoros manually
    window.incrementTaskPomo = function(taskId) {
        const task = window.AetherState.tasks.find(t => t.id === taskId);
        if (task && !task.completed) {
            task.completedPomodoros = Math.min(task.estPomodoros, task.completedPomodoros + 1);
            window.saveState();
            renderTasks();
        }
    };

    // Delete task
    window.deleteTask = function(taskId) {
        window.AetherState.tasks = window.AetherState.tasks.filter(t => t.id !== taskId);
        
        // If the task was linked to pomodoro, unlink it
        if (window.AetherState.pomodoro.linkedTaskId === taskId) {
            window.AetherState.pomodoro.linkedTaskId = null;
        }
        
        window.saveState();
        renderTasks();
        if (window.refreshPomodoroTaskSelect) {
            window.refreshPomodoroTaskSelect();
        }
    };

    // Render Function
    function renderTasks() {
        const tasks = window.AetherState.tasks;
        
        // Apply Filter
        const filteredTasks = tasks.filter(task => {
            if (currentFilter === 'all') return true;
            if (currentFilter === 'High' || currentFilter === 'Medium') return task.priority === currentFilter;
            return task.tag === currentFilter;
        });
        
        // Clear containers
        activeTasksContainer.innerHTML = '';
        completedTasksContainer.innerHTML = '';
        
        let activeCount = 0;
        let completedCount = 0;
        
        filteredTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
            
            // Build tomatoes indicators
            let tomatoes = '';
            for (let i = 0; i < task.estPomodoros; i++) {
                if (i < task.completedPomodoros) {
                    tomatoes += '<span class="pomo-tomato">🍅</span>';
                } else {
                    tomatoes += '<span class="pomo-tomato" style="opacity: 0.25;">🍅</span>';
                }
            }
            
            card.innerHTML = `
                <div class="task-card-header">
                    <div class="task-card-title">${escapeHTML(task.title)}</div>
                    <span class="tag-badge tag-${task.tag}">${task.tag}</span>
                </div>
                <div class="task-card-meta">
                    <div class="task-card-pomo-status">
                        ${tomatoes}
                        <span style="margin-left: 4px;">(${task.completedPomodoros}/${task.estPomodoros})</span>
                    </div>
                    <div class="task-actions">
                        ${!task.completed ? `
                            <button class="action-btn btn-increment-pomo" onclick="incrementTaskPomo('${task.id}')" title="Log Focus Cycle">
                                ➕
                            </button>
                        ` : ''}
                        <button class="action-btn btn-complete-task" onclick="toggleTaskComplete('${task.id}')" title="${task.completed ? 'Mark Active' : 'Mark Completed'}">
                            ${task.completed ? '⏪' : '✅'}
                        </button>
                        <button class="action-btn btn-delete-task" onclick="deleteTask('${task.id}')" title="Delete Task">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
            
            if (task.completed) {
                completedTasksContainer.appendChild(card);
                completedCount++;
            } else {
                activeTasksContainer.appendChild(card);
                activeCount++;
            }
        });
        
        // Update Count Badges
        activeCountBadge.innerText = activeCount;
        completedCountBadge.innerText = completedCount;
        
        // Empty States
        if (activeCount === 0) {
            activeTasksContainer.innerHTML = `<div class="empty-state">No active tasks in this view.</div>`;
        }
        if (completedCount === 0) {
            completedTasksContainer.innerHTML = `<div class="empty-state">Complete tasks to show achievements!</div>`;
        }
    }

    // Helper: Escape HTML string to avoid injection
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Expose render function to global scope
    window.renderTasks = renderTasks;

    // Run render on load
    document.addEventListener('DOMContentLoaded', () => {
        renderTasks();
    });
})();
