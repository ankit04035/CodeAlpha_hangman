/* ==========================================================================
   Aether Study Planner - Core Orchestrator & State Management
   ========================================================================== */

// Initialize Global State
window.AetherState = {
    theme: 'dark',
    activeTab: 'dashboard',
    tasks: [],
    pomodoro: {
        timeLeft: 1500, // 25 mins in seconds
        durationWork: 25,
        durationShortBreak: 5,
        durationLongBreak: 15,
        timerId: null,
        mode: 'work', // 'work', 'shortBreak', 'longBreak'
        isRunning: false,
        linkedTaskId: null,
        soundEnabled: true,
        stats: {
            focusMinutes: 0
        }
    },
    flashcards: {
        decks: [],
        reviewedCount: 0
    },
    quizzes: [],
    quizHistory: [], // Array of scores: { quizId, scorePercent, date }
    reminders: [] // Array of scheduled reminder objects
};

// LocalStorage Keys
const STORAGE_KEY = 'AETHER_STUDY_STATE';

// Web Audio API Synthesizer Context
let audioCtx = null;

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Chime synthesizers using Web Audio API
window.playChime = function(type) {
    try {
        initAudioContext();
        if (!window.AetherState.pomodoro.soundEnabled) return;
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const now = audioCtx.currentTime;
        
        if (type === 'work-start') {
            // Ascending major chord (pleasant notification)
            const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
            notes.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);
                
                gain.gain.setValueAtTime(0, now + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.4);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.4);
            });
        } else if (type === 'break-start') {
            // Descending major-seventh chords
            const notes = [523.25, 493.88, 392.00, 329.63]; // C5, B4, G4, E4
            notes.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);
                
                gain.gain.setValueAtTime(0, now + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.5);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.5);
            });
        } else if (type === 'alarm') {
            // High pitch pulsing alarm
            const repetitions = 3;
            for(let j = 0; j < repetitions; j++) {
                const triggerTime = now + j * 0.35;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, triggerTime); // A5
                
                gain.gain.setValueAtTime(0, triggerTime);
                gain.gain.linearRampToValueAtTime(0.2, triggerTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, triggerTime + 0.3);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(triggerTime);
                osc.stop(triggerTime + 0.3);
            }
        } else if (type === 'correct') {
            // Quick happy ping
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc2.frequency.setValueAtTime(659.25, now + 0.05); // E5
            osc1.type = 'sine';
            osc2.type = 'sine';
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc1.start(now);
            osc2.start(now + 0.05);
            osc1.stop(now + 0.35);
            osc2.stop(now + 0.35);
        } else if (type === 'wrong') {
            // Low dull buzz
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(150, now);
            osc.type = 'sawtooth';
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch(e) {
        console.warn("Audio Context block or error: ", e);
    }
};

// Sync State Helper
window.saveState = function() {
    // Timer instances can't be saved, strip them
    const timerId = window.AetherState.pomodoro.timerId;
    window.AetherState.pomodoro.timerId = null;
    
    // Reminders state carries ticking handles which we rebuild later, strip those
    const reminderTimers = window.AetherState.reminders.map(r => {
        const copy = {...r};
        delete copy._intervalId;
        return copy;
    });
    
    const stateToSave = {
        ...window.AetherState,
        reminders: reminderTimers
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    
    // Put them back
    window.AetherState.pomodoro.timerId = timerId;
    
    // Re-render dashboard components
    window.updateDashboardStats();
};

// Load State from storage
function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            window.AetherState = {
                ...window.AetherState,
                ...parsed,
                // Ensure nesting structures are preserved properly
                pomodoro: {
                    ...window.AetherState.pomodoro,
                    ...parsed.pomodoro,
                    timerId: null,
                    isRunning: false // Always start stopped
                },
                flashcards: {
                    ...window.AetherState.flashcards,
                    ...parsed.flashcards
                }
            };
        } catch(e) {
            console.error("Failed to parse Aether Study state: ", e);
            loadDefaults();
        }
    } else {
        loadDefaults();
    }
}

// Load default mock data for premium wow-factor
function loadDefaults() {
    window.AetherState.tasks = [
        { id: '1', title: 'Complete Calculus Chapter 2 Exercises', tag: 'Study', priority: 'High', estPomodoros: 3, completedPomodoros: 1, completed: false },
        { id: '2', title: 'Revise History Flashcards: French Revolution', tag: 'Reading', priority: 'Medium', estPomodoros: 2, completedPomodoros: 2, completed: true },
        { id: '3', title: 'Draft Chemistry Lab Report draft', tag: 'Project', priority: 'Medium', estPomodoros: 4, completedPomodoros: 0, completed: false }
    ];
    
    window.AetherState.flashcards.decks = [
        {
            id: 'd1',
            title: 'Biology 101 - Cell Structures',
            desc: 'Essential cellular terminology and organelles functionality.',
            cards: [
                { front: 'Mitochondria', back: 'Organelle responsible for cellular respiration, often called the powerhouse of the cell as it generates ATP.' },
                { front: 'Ribosome', back: 'Complex molecular machine found inside all living cells that performs biological protein synthesis.' },
                { front: 'Lysosome', back: 'Membrane-bound organelle containing digestive enzymes used to break down waste materials.' }
            ]
        },
        {
            id: 'd2',
            title: 'Spanish Vocabulary - Basics',
            desc: 'Fundamental Spanish verbs and common expressions.',
            cards: [
                { front: 'To learn', back: 'Aprender' },
                { front: 'To write', back: 'Escribir' },
                { front: 'To study', back: 'Estudiar' }
            ]
        }
    ];

    window.AetherState.quizzes = [
        {
            id: 'q1',
            title: 'General Science Quiz',
            category: 'Basic Science',
            questions: [
                {
                    question: 'What is the chemical symbol for Gold?',
                    choices: ['Ag', 'Au', 'Fe', 'Gd'],
                    correctAnswer: 1
                },
                {
                    question: 'Which gas do plants absorb from the atmosphere?',
                    choices: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
                    correctAnswer: 2
                },
                {
                    question: 'What is the speed of light approx?',
                    choices: ['300,000 km/s', '150,000 km/s', '1,000,000 km/s', '3,000 km/s'],
                    correctAnswer: 0
                }
            ]
        }
    ];
    
    window.AetherState.quizHistory = [
        { quizId: 'q1', scorePercent: 100, date: new Date().toISOString() }
    ];

    window.AetherState.pomodoro.stats.focusMinutes = 75;
    window.AetherState.flashcards.reviewedCount = 12;
}

// Router & View switcher
function setupRouter() {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Quick links from dashboard widgets
    document.querySelectorAll('[data-tab-link]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab-link');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Update menu items
    menuItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Transition panes
    tabPanes.forEach(pane => {
        if (pane.id === `${tabId}-tab`) {
            pane.style.display = 'block';
            setTimeout(() => {
                pane.classList.add('active');
            }, 50);
        } else {
            pane.classList.remove('active');
            pane.style.display = 'none';
        }
    });
    
    window.AetherState.activeTab = tabId;
    
    // Update Page Header Titles
    const titleMap = {
        'dashboard': { title: 'Study Dashboard', sub: 'Welcome back! Ready for another focused study session?' },
        'tasks': { title: 'Study Task Board', sub: 'Break your assignments down and track estimation cycles.' },
        'pomodoro': { title: 'Pomodoro Timer', sub: 'Engage deep-work intervals and periodic brain rests.' },
        'flashcards': { title: 'Spaced Flashcards', sub: 'Study custom decks styled to maximize active recall.' },
        'quizzes': { title: 'Recall Quiz Maker', sub: 'Construct custom check-in tests or complete revision modules.' },
        'reminders': { title: 'Active Reminders', sub: 'Schedule active quiz pop-ups to block procrastination.' }
    };
    
    const info = titleMap[tabId] || { title: 'Study Hub', sub: '' };
    document.getElementById('page-title').innerText = info.title;
    document.getElementById('page-subtitle').innerText = info.sub;

    // Trigger tab-specific refresh routines if any
    if (tabId === 'pomodoro' && window.refreshPomodoroTaskSelect) {
        window.refreshPomodoroTaskSelect();
    }
    if (tabId === 'flashcards' && window.renderDecks) {
        window.renderDecks();
    }
    if (tabId === 'quizzes' && window.renderQuizzes) {
        window.renderQuizzes();
    }
    if (tabId === 'reminders' && window.renderReminders) {
        window.renderReminders();
    }
}

// Dashboard statistics renderer
window.updateDashboardStats = function() {
    // Focus Minutes
    document.getElementById('stat-focus-time').innerText = window.AetherState.pomodoro.stats.focusMinutes;
    
    // Completed Tasks Done
    const completedTasks = window.AetherState.tasks.filter(t => t.completed).length;
    const totalTasks = window.AetherState.tasks.length;
    document.getElementById('stat-tasks-done').innerText = `${completedTasks}/${totalTasks}`;
    
    // Cards Reviewed
    document.getElementById('stat-cards-reviewed').innerText = window.AetherState.flashcards.reviewedCount;
    
    // Quiz Score
    let avgScore = 0;
    if (window.AetherState.quizHistory.length > 0) {
        const sum = window.AetherState.quizHistory.reduce((acc, q) => acc + q.scorePercent, 0);
        avgScore = Math.round(sum / window.AetherState.quizHistory.length);
    }
    document.getElementById('stat-quiz-score').innerText = `${avgScore}%`;

    // Render Widget Preview items
    renderDashboardWidgets();
};

function renderDashboardWidgets() {
    // Render Active Tasks widget preview
    const widgetTasksContainer = document.getElementById('widget-tasks-list');
    const activeTasks = window.AetherState.tasks.filter(t => !t.completed).slice(0, 3);
    
    if (activeTasks.length === 0) {
        widgetTasksContainer.innerHTML = `<div class="empty-state">No active focus tasks. Add tasks in the Task tab!</div>`;
    } else {
        widgetTasksContainer.innerHTML = activeTasks.map(task => `
            <div class="task-card priority-${task.priority}" style="padding: 12px; margin-bottom: 0;">
                <div class="task-card-header" style="gap: 5px;">
                    <div class="task-card-title" style="font-size: 13px;">${task.title}</div>
                    <span class="tag-badge tag-${task.tag}" style="font-size: 9px; padding: 2px 6px;">${task.tag}</span>
                </div>
                <div class="task-card-meta">
                    <div class="task-card-pomo-status" style="font-size: 11px;">
                        <span class="pomo-tomato">🍅</span> ${task.completedPomodoros}/${task.estPomodoros}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render scheduled reminders widget preview
    const widgetRemindersContainer = document.getElementById('widget-reminders-list');
    if (window.AetherState.reminders.length === 0) {
        widgetRemindersContainer.innerHTML = `<div class="empty-state">No scheduled reminders. Add one in the Reminders tab!</div>`;
    } else {
        widgetRemindersContainer.innerHTML = window.AetherState.reminders.slice(0, 3).map(r => `
            <div class="reminder-card" style="padding: 10px 14px; margin-bottom: 0; font-size: 13px;">
                <div class="reminder-info">
                    <h3 style="font-size: 13px;">${r.title}</h3>
                </div>
                <span class="reminder-time-badge" style="font-size: 9px; padding: 2px 6px;">${r.interval} ${r.unit}</span>
            </div>
        `).join('');
    }
}

// Theme Engine Setup
function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    
    // Initial check
    if (window.AetherState.theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
    }
    
    btn.addEventListener('click', () => {
        initAudioContext();
        if (document.body.getAttribute('data-theme') === 'light') {
            document.body.removeAttribute('data-theme');
            window.AetherState.theme = 'dark';
        } else {
            document.body.setAttribute('data-theme', 'light');
            window.AetherState.theme = 'light';
        }
        window.saveState();
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupRouter();
    setupTheme();
    window.updateDashboardStats();
    
    // Global mouse event to unlock browser audio context on user gesture
    document.addEventListener('click', function gestureUnlock() {
        initAudioContext();
        document.removeEventListener('click', gestureUnlock);
    }, { once: true });
});
