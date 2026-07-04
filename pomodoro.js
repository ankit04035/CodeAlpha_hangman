/* ==========================================================================
   Aether Study Planner - Pomodoro Module
   ========================================================================== */

(function() {
    // Timer state references (referencing global AetherState.pomodoro)
    let state = window.AetherState.pomodoro;
    
    // Ticking timestamp markers for background throttle safety
    let timerTargetTime = null; 

    // DOM Elements
    const mainTimeDisplay = document.getElementById('timer-display-time');
    const mainLabelDisplay = document.getElementById('timer-display-label');
    const progressBar = document.getElementById('timer-progress-bar');
    
    const widgetTimeDisplay = document.getElementById('widget-timer-time');
    const widgetLabelDisplay = document.getElementById('widget-timer-label');
    
    const timerToggleBtn = document.getElementById('timer-toggle-btn');
    const timerResetBtn = document.getElementById('timer-reset-btn');
    const timerSoundBtn = document.getElementById('timer-sound-toggle');
    
    const widgetToggleBtn = document.getElementById('widget-timer-toggle');
    const widgetResetBtn = document.getElementById('widget-timer-reset');
    
    const navPreview = document.getElementById('nav-timer-preview');
    
    const modeButtons = document.querySelectorAll('.mode-btn');
    const taskSelect = document.getElementById('pomo-focus-task-select');
    const activeTaskDetails = document.getElementById('selected-task-details');
    const activeTaskName = document.getElementById('pomo-active-task-name');
    const activeTaskCount = document.getElementById('pomo-active-task-count');
    
    // Custom durations input fields
    const workDurInput = document.getElementById('dur-work');
    const shortDurInput = document.getElementById('dur-short');
    const longDurInput = document.getElementById('dur-long');
    const applyDurationsBtn = document.getElementById('apply-durations-btn');

    // Circular SVG helper properties
    const circumference = 628.3; // 2 * pi * r (r=100)

    // Load initial form input values from state
    workDurInput.value = state.durationWork;
    shortDurInput.value = state.durationShortBreak;
    longDurInput.value = state.durationLongBreak;

    // Apply custom durations
    applyDurationsBtn.addEventListener('click', () => {
        const workVal = Math.max(1, parseInt(workDurInput.value, 10)) || 25;
        const shortVal = Math.max(1, parseInt(shortDurInput.value, 10)) || 5;
        const longVal = Math.max(1, parseInt(longDurInput.value, 10)) || 15;
        
        state.durationWork = workVal;
        state.durationShortBreak = shortVal;
        state.durationLongBreak = longVal;
        
        window.saveState();
        
        // Reset timer to reflect new duration for current mode
        resetTimer();
        alert("Session durations updated successfully!");
    });

    // Handle Active Task Selector
    taskSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        state.linkedTaskId = val || null;
        window.saveState();
        updateFocusedTaskUI();
    });

    function updateFocusedTaskUI() {
        if (state.linkedTaskId) {
            const task = window.AetherState.tasks.find(t => t.id === state.linkedTaskId);
            if (task && !task.completed) {
                activeTaskDetails.className = ''; // Remove hidden class
                activeTaskName.innerText = task.title;
                activeTaskCount.innerText = `${task.completedPomodoros} / ${task.estPomodoros}`;
                return;
            }
        }
        // Fallback: hide active task card
        activeTaskDetails.className = 'selected-task-details-hidden';
        state.linkedTaskId = null;
    }

    // Refresh Active Task Select Dropdown list
    window.refreshPomodoroTaskSelect = function() {
        const activeTasks = window.AetherState.tasks.filter(t => !t.completed);
        
        // Save current selected value if still active
        const selectedId = state.linkedTaskId;
        
        taskSelect.innerHTML = `<option value="">-- Study general topics --</option>`;
        activeTasks.forEach(task => {
            const opt = document.createElement('option');
            opt.value = task.id;
            opt.innerText = `📚 [${task.priority}] ${task.title}`;
            if (task.id === selectedId) {
                opt.selected = true;
            }
            taskSelect.appendChild(opt);
        });
        
        updateFocusedTaskUI();
    };

    // Mode switching handler
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.getAttribute('data-mode');
            setMode(mode);
        });
    });

    function setMode(mode) {
        stopTimer();
        state.mode = mode;
        
        if (mode === 'work') {
            state.timeLeft = state.durationWork * 60;
            mainLabelDisplay.innerText = "WORK TIME";
            widgetLabelDisplay.innerText = "WORK CYCLE";
        } else if (mode === 'shortBreak') {
            state.timeLeft = state.durationShortBreak * 60;
            mainLabelDisplay.innerText = "SHORT BREAK";
            widgetLabelDisplay.innerText = "SHORT BREAK";
        } else if (mode === 'longBreak') {
            state.timeLeft = state.durationLongBreak * 60;
            mainLabelDisplay.innerText = "LONG BREAK";
            widgetLabelDisplay.innerText = "LONG BREAK";
        }
        
        // Update color scheme of timer ring based on mode
        updateTimerColors();
        updateDisplays();
    }

    function updateTimerColors() {
        if (state.mode === 'work') {
            progressBar.style.stroke = "var(--primary)";
            mainLabelDisplay.style.color = "var(--primary)";
            widgetLabelDisplay.style.color = "var(--primary)";
        } else {
            progressBar.style.stroke = "var(--secondary)";
            mainLabelDisplay.style.color = "var(--secondary)";
            widgetLabelDisplay.style.color = "var(--secondary)";
        }
    }

    // Toggle timer status
    function toggleTimer() {
        if (state.isRunning) {
            stopTimer();
        } else {
            startTimer();
        }
    }

    function startTimer() {
        if (state.isRunning) return;
        
        state.isRunning = true;
        timerTargetTime = Date.now() + (state.timeLeft * 1000);
        
        // Trigger Audio Chime
        if (state.mode === 'work') {
            window.playChime('work-start');
        } else {
            window.playChime('break-start');
        }

        // Ticking loop
        state.timerId = setInterval(() => {
            const timeDiff = Math.max(0, Math.round((timerTargetTime - Date.now()) / 1000));
            state.timeLeft = timeDiff;
            
            updateDisplays();
            
            if (state.timeLeft <= 0) {
                handleTimerCompletion();
            }
        }, 1000);
        
        updateControlsUI();
    }

    function stopTimer() {
        if (!state.isRunning) return;
        
        state.isRunning = false;
        if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
        }
        
        updateControlsUI();
        updateDisplays();
    }

    function resetTimer() {
        stopTimer();
        setMode(state.mode);
    }

    // Completion routines
    function handleTimerCompletion() {
        stopTimer();
        
        // Sound Alarm chimes
        window.playChime('alarm');
        
        if (state.mode === 'work') {
            // Log focus stats
            window.AetherState.pomodoro.stats.focusMinutes += state.durationWork;
            
            // Log linked task pomodoro completion
            if (state.linkedTaskId) {
                const task = window.AetherState.tasks.find(t => t.id === state.linkedTaskId);
                if (task) {
                    task.completedPomodoros = Math.min(task.estPomodoros, task.completedPomodoros + 1);
                    if (window.renderTasks) window.renderTasks();
                }
            }
            
            // Auto transition to shortBreak
            alert("Great work! Session complete. Time to take a short break.");
            setMode('shortBreak');
            // Auto-trigger break ticking if wanted, or let it idle. Let's idle so the user can stand up.
        } else {
            // Break completed
            alert("Break is over! Get ready to focus again.");
            setMode('work');
        }
        
        window.saveState();
        updateFocusedTaskUI();
        updateDisplays();
    }

    // Render displays
    function updateDisplays() {
        const mins = Math.floor(state.timeLeft / 60);
        const secs = state.timeLeft % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Page view timer text
        mainTimeDisplay.innerText = timeStr;
        
        // Dashboard widget view timer text
        widgetTimeDisplay.innerText = timeStr;
        
        // Nav bar small preview text
        let statusText = state.isRunning ? `Focusing: ${timeStr}` : 'Timer Paused';
        if (!state.isRunning && state.timeLeft === 1500) statusText = 'Timer Ready';
        navPreview.innerText = statusText;
        
        // Circular progress ring offset calculation
        let maxDuration = 1500;
        if (state.mode === 'work') maxDuration = state.durationWork * 60;
        else if (state.mode === 'shortBreak') maxDuration = state.durationShortBreak * 60;
        else if (state.mode === 'longBreak') maxDuration = state.durationLongBreak * 60;
        
        const progressFraction = state.timeLeft / maxDuration;
        const offset = circumference * (1 - progressFraction);
        progressBar.style.strokeDashoffset = offset;
    }

    // Sync button icons
    function updateControlsUI() {
        const playSvg = `<svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="3" fill="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        const pauseSvg = `<svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="3" fill="none"><line x1="18" y1="4" x2="18" y2="20"></line><line x1="6" y1="4" x2="6" y2="20"></line></svg>`;
        
        if (state.isRunning) {
            timerToggleBtn.innerHTML = pauseSvg;
            widgetToggleBtn.innerText = "Pause";
        } else {
            timerToggleBtn.innerHTML = playSvg;
            widgetToggleBtn.innerText = "Start Focus";
        }
    }

    // Sound toggle control
    timerSoundBtn.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        window.saveState();
        updateSoundButtonUI();
    });

    function updateSoundButtonUI() {
        const soundOnSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        const soundOffSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
        
        timerSoundBtn.innerHTML = state.soundEnabled ? soundOnSvg : soundOffSvg;
        timerSoundBtn.setAttribute('title', state.soundEnabled ? 'Mute Sounds' : 'Unmute Sounds');
    }

    // Attach Click Event listeners
    timerToggleBtn.addEventListener('click', toggleTimer);
    timerResetBtn.addEventListener('click', resetTimer);
    
    widgetToggleBtn.addEventListener('click', toggleTimer);
    widgetResetBtn.addEventListener('click', resetTimer);

    // Initial setups
    document.addEventListener('DOMContentLoaded', () => {
        state = window.AetherState.pomodoro; // Rebind to loaded state
        updateDisplays();
        updateTimerColors();
        updateSoundButtonUI();
        window.refreshPomodoroTaskSelect();
    });
})();
