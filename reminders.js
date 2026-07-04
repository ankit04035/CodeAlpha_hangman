/* ==========================================================================
   Aether Study Planner - Active Recall Reminders Module
   ========================================================================== */

(function() {
    // DOM Elements
    const reminderForm = document.getElementById('reminder-form');
    const reminderTitleInput = document.getElementById('reminder-title');
    const reminderQuizSelect = document.getElementById('reminder-quiz-select');
    const reminderIntervalInput = document.getElementById('reminder-interval');
    const reminderUnitSelect = document.getElementById('reminder-unit');
    const remindersListContainer = document.getElementById('reminders-list-container');

    // Pop-up Alert Modal Elements
    const reminderModal = document.getElementById('reminder-quiz-modal');
    const modalTitle = document.getElementById('modal-reminder-title');
    const modalQuizName = document.getElementById('modal-reminder-quiz-name');
    const modalQuestionText = document.getElementById('modal-reminder-question-text');
    const modalOptions = document.getElementById('modal-reminder-options');
    const modalFeedback = document.getElementById('modal-feedback-pane');
    const modalFeedbackMsg = document.getElementById('modal-feedback-message');
    const modalSnoozeBtn = document.getElementById('modal-snooze-btn');

    // Active Reminder currently showing in the Modal
    let activeReminderInstance = null;
    let activeModalQuestion = null;
    let activeSnoozeTimeout = null;

    // Form Submission
    reminderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = reminderTitleInput.value.trim();
        const quizId = reminderQuizSelect.value;
        const interval = parseInt(reminderIntervalInput.value, 10);
        const unit = reminderUnitSelect.value;
        
        if (!title || !quizId || !interval) return;
        
        const newReminder = {
            id: 'reminder_' + Date.now(),
            title: title,
            quizId: quizId,
            interval: interval,
            unit: unit
        };
        
        window.AetherState.reminders.push(newReminder);
        window.saveState();
        
        // Start Timer loop in memory
        startReminderTimer(newReminder);
        
        // Reset fields
        reminderTitleInput.value = '';
        reminderQuizSelect.selectedIndex = 0;
        reminderIntervalInput.value = 5;
        reminderUnitSelect.value = 'minutes';
        
        renderReminders();
        alert("Active recall reminder scheduled successfully!");
    });

    // Populate Quizzes Select list inside the reminder scheduler
    function refreshReminderQuizDropdown() {
        const selectedValue = reminderQuizSelect.value;
        reminderQuizSelect.innerHTML = `<option value="" disabled selected>-- Select a Quiz --</option>`;
        
        window.AetherState.quizzes.forEach(quiz => {
            const opt = document.createElement('option');
            opt.value = quiz.id;
            opt.innerText = `${quiz.title} (${quiz.questions.length} Qs)`;
            if (quiz.id === selectedValue) {
                opt.selected = true;
            }
            reminderQuizSelect.appendChild(opt);
        });
    }

    // Convert intervals (secs, mins, hrs) to actual milliseconds
    function getMilliseconds(interval, unit) {
        if (unit === 'seconds') return interval * 1000;
        if (unit === 'minutes') return interval * 60000;
        if (unit === 'hours') return interval * 3600000;
        return interval * 60000; // default minutes
    }

    // Launch interval timers
    function startReminderTimer(reminder) {
        // Clear existing just in case
        if (reminder._intervalId) {
            clearInterval(reminder._intervalId);
        }
        
        const ms = getMilliseconds(reminder.interval, reminder.unit);
        
        reminder._intervalId = setInterval(() => {
            triggerReminderAlert(reminder);
        }, ms);
    }

    // Trigger Pop-up Modal when timer fires
    function triggerReminderAlert(reminder) {
        // If another reminder modal is already showing, queue/delay this one
        if (activeReminderInstance) return;
        
        const quiz = window.AetherState.quizzes.find(q => q.id === reminder.quizId);
        if (!quiz || quiz.questions.length === 0) return; // Silent discard if source quiz missing questions
        
        // Select a random question from target quiz
        const randomIdx = Math.floor(Math.random() * quiz.questions.length);
        const question = quiz.questions[randomIdx];
        
        activeReminderInstance = reminder;
        activeModalQuestion = question;
        
        // Configure modal DOM
        modalTitle.innerText = `Focus Check: ${reminder.title}`;
        modalQuizName.innerText = `Topic: ${quiz.title}`;
        modalQuestionText.innerText = question.question;
        
        modalFeedback.classList.add('hidden');
        
        // Build option buttons
        modalOptions.innerHTML = '';
        question.choices.forEach((choice, i) => {
            const btn = document.createElement('button');
            btn.className = 'reminder-modal-option-btn';
            btn.innerText = choice;
            btn.addEventListener('click', () => handleModalAnswer(i, btn));
            modalOptions.appendChild(btn);
        });
        
        // Ring alarm chime
        window.playChime('alarm');
        
        // Display Modal
        reminderModal.classList.remove('hidden');
    }

    function handleModalAnswer(choiceIdx, buttonEl) {
        const correctIdx = activeModalQuestion.correctAnswer;
        const optionsButtons = modalOptions.querySelectorAll('.reminder-modal-option-btn');
        
        if (choiceIdx === correctIdx) {
            // Correct answer
            buttonEl.classList.add('correct');
            window.playChime('correct');
            
            modalFeedbackMsg.innerText = "🎉 Correct! Keep up the great focus.";
            modalFeedback.className = 'reminder-modal-feedback correct-feedback';
            
            // Lock UI and close modal after 1.2s delay
            setTimeout(() => {
                closeReminderModal();
            }, 1200);
        } else {
            // Incorrect answer
            buttonEl.classList.add('wrong');
            window.playChime('wrong');
            
            // Highlight correct one
            optionsButtons[correctIdx].classList.add('correct');
            
            modalFeedbackMsg.innerText = "❌ Incorrect recall! Review the correct answer above.";
            modalFeedback.className = 'reminder-modal-feedback wrong-feedback';
            
            // Disable choices, allow close in 2s
            optionsButtons.forEach(btn => btn.disabled = true);
            setTimeout(() => {
                closeReminderModal();
            }, 2500);
        }
    }

    // Snooze option - triggers again shortly
    modalSnoozeBtn.addEventListener('click', () => {
        if (!activeReminderInstance) return;
        
        const snoozeReminder = {...activeReminderInstance};
        closeReminderModal();
        
        // Trigger snooze alert in 15 seconds (for quick testing) or 2 minutes
        const snoozeTime = snoozeReminder.unit === 'seconds' ? 5000 : 120000;
        
        activeSnoozeTimeout = setTimeout(() => {
            triggerReminderAlert(snoozeReminder);
        }, snoozeTime);
        
        alert("Reminder snoozed.");
    });

    function closeReminderModal() {
        reminderModal.classList.add('hidden');
        activeReminderInstance = null;
        activeModalQuestion = null;
        if (activeSnoozeTimeout) {
            clearTimeout(activeSnoozeTimeout);
            activeSnoozeTimeout = null;
        }
    }

    // Delete Reminder
    window.deleteReminder = function(reminderId) {
        const reminderIndex = window.AetherState.reminders.findIndex(r => r.id === reminderId);
        if (reminderIndex > -1) {
            const reminder = window.AetherState.reminders[reminderIndex];
            
            // Clear ticking timers
            if (reminder._intervalId) {
                clearInterval(reminder._intervalId);
            }
            
            window.AetherState.reminders.splice(reminderIndex, 1);
            window.saveState();
            renderReminders();
        }
    };

    // Render scheduled list
    function renderReminders() {
        const reminders = window.AetherState.reminders;
        remindersListContainer.innerHTML = '';
        
        if (reminders.length === 0) {
            remindersListContainer.innerHTML = `<div class="empty-state">No scheduled active recall reminders.</div>`;
        } else {
            reminders.forEach(r => {
                const quiz = window.AetherState.quizzes.find(q => q.id === r.quizId);
                const quizName = quiz ? quiz.title : 'Deleted Quiz';
                
                const card = document.createElement('div');
                card.className = 'reminder-card';
                card.innerHTML = `
                    <div class="reminder-info">
                        <h3>${escapeHTML(r.title)}</h3>
                        <p style="font-size:12px;">Quiz: <strong style="color:var(--primary);">${escapeHTML(quizName)}</strong></p>
                    </div>
                    <div style="display:flex; align-items:center; gap: 15px;">
                        <span class="reminder-time-badge">${r.interval} ${r.unit}</span>
                        <button class="btn-delete-reminder" onclick="deleteReminder('${r.id}')" title="Delete Reminder">
                            🗑️
                        </button>
                    </div>
                `;
                remindersListContainer.appendChild(card);
            });
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Expose select boxes refresh
    window.refreshReminderQuizDropdown = refreshReminderQuizDropdown;
    window.renderReminders = renderReminders;

    // Initialization on Startup
    document.addEventListener('DOMContentLoaded', () => {
        refreshReminderQuizDropdown();
        renderReminders();
        
        // Launch timers for all loaded reminders
        window.AetherState.reminders.forEach(reminder => {
            startReminderTimer(reminder);
        });
    });
})();
