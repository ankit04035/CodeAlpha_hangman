/* ==========================================================================
   Aether Study Planner - Quiz Maker Module
   ========================================================================== */

(function() {
    // DOM Elements
    const quizInfoForm = document.getElementById('quiz-info-form');
    const quizTitleInput = document.getElementById('quiz-title');
    const quizCategoryInput = document.getElementById('quiz-category');
    const questionsBuilder = document.getElementById('questions-list-builder');
    const addQuestionBtn = document.getElementById('btn-add-question');
    const quizzesGrid = document.getElementById('quizzes-grid-container');

    // Quiz Play View Elements
    const playView = document.getElementById('quiz-active-play-view');
    const playCloseBtn = document.getElementById('quiz-play-close-btn');
    const playTitle = document.getElementById('play-quiz-title');
    const playProgressBar = document.getElementById('play-quiz-progress-bar');
    const playQCounter = document.getElementById('play-quiz-q-counter');
    const playQuestionText = document.getElementById('play-quiz-question-text');
    const playOptionsContainer = document.getElementById('play-quiz-options');
    const playNextBtn = document.getElementById('play-quiz-next-btn');

    // Quiz Result View Elements
    const resultView = document.getElementById('quiz-result-view');
    const resultTitle = document.getElementById('result-quiz-title');
    const resultScoreRatio = document.getElementById('result-score-ratio');
    const resultScorePercent = document.getElementById('result-score-percent');
    const resultScoreMsg = document.getElementById('result-score-message');
    const resultReviewList = document.getElementById('result-review-list');
    const resultCloseBtn = document.getElementById('result-close-btn');

    // Internal Builder / Play states
    let questionCounter = 0;
    
    let activePlayQuiz = null;
    let playCurrentQIndex = 0;
    let playScore = 0;
    let selectedOptionIndex = null;
    let isQuestionAnswered = false;
    let playWrongAnswersReview = []; // Track failures for the results pane

    // Add Initial question builder card on startup
    addQuestionCard();

    // Question Builder Actions
    addQuestionBtn.addEventListener('click', () => {
        addQuestionCard();
    });

    function addQuestionCard() {
        questionCounter++;
        const cardId = 'q_card_' + questionCounter;
        
        const qCard = document.createElement('div');
        qCard.className = 'question-form-card';
        qCard.id = cardId;
        
        qCard.innerHTML = `
            <button type="button" class="btn-remove-q" onclick="removeQuestionCard('${cardId}')" title="Remove Question">&times;</button>
            <div class="form-group" style="margin-bottom: 12px;">
                <label>Question Text</label>
                <input type="text" placeholder="e.g., What is the chemical formula for water?" class="builder-q-text" required>
            </div>
            
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); display:block; margin-bottom: 6px;">MULTIPLE CHOICE OPTIONS</label>
            <div class="options-builder">
                <div class="option-input-row">
                    <span class="option-prefix">A</span>
                    <input type="text" class="builder-opt-0" placeholder="Option A" required>
                    <input type="radio" name="correct_${cardId}" value="0" checked>
                </div>
                <div class="option-input-row">
                    <span class="option-prefix">B</span>
                    <input type="text" class="builder-opt-1" placeholder="Option B" required>
                    <input type="radio" name="correct_${cardId}" value="1">
                </div>
                <div class="option-input-row">
                    <span class="option-prefix">C</span>
                    <input type="text" class="builder-opt-2" placeholder="Option C" required>
                    <input type="radio" name="correct_${cardId}" value="2">
                </div>
                <div class="option-input-row">
                    <span class="option-prefix">D</span>
                    <input type="text" class="builder-opt-3" placeholder="Option D" required>
                    <input type="radio" name="correct_${cardId}" value="3">
                </div>
            </div>
            <p class="help-block" style="font-size: 10px; color: var(--text-muted); margin-top:8px;">* Select the radio button corresponding to the correct option.</p>
        `;
        
        questionsBuilder.appendChild(qCard);
    }

    window.removeQuestionCard = function(cardId) {
        const card = document.getElementById(cardId);
        if (card) {
            // Ensure at least one question exists
            const totalCards = questionsBuilder.querySelectorAll('.question-form-card').length;
            if (totalCards <= 1) {
                alert("A quiz must have at least one question!");
                return;
            }
            card.remove();
        }
    };

    // Quiz Publish Form submit
    quizInfoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = quizTitleInput.value.trim();
        const category = quizCategoryInput.value.trim() || 'General';
        
        // Compile questions
        const qCards = questionsBuilder.querySelectorAll('.question-form-card');
        const compiledQuestions = [];
        
        let isValid = true;
        
        qCards.forEach(card => {
            const cardId = card.id;
            const qText = card.querySelector('.builder-q-text').value.trim();
            const opt0 = card.querySelector('.builder-opt-0').value.trim();
            const opt1 = card.querySelector('.builder-opt-1').value.trim();
            const opt2 = card.querySelector('.builder-opt-2').value.trim();
            const opt3 = card.querySelector('.builder-opt-3').value.trim();
            
            const radioCorrect = card.querySelector(`input[name="correct_${cardId}"]:checked`);
            const correctIndex = radioCorrect ? parseInt(radioCorrect.value, 10) : 0;
            
            if (!qText || !opt0 || !opt1 || !opt2 || !opt3) {
                isValid = false;
                return;
            }
            
            compiledQuestions.push({
                question: qText,
                choices: [opt0, opt1, opt2, opt3],
                correctAnswer: correctIndex
            });
        });
        
        if (!isValid || compiledQuestions.length === 0) {
            alert("Please fill in all question fields and options!");
            return;
        }
        
        const newQuiz = {
            id: 'quiz_' + Date.now(),
            title: title,
            category: category,
            questions: compiledQuestions
        };
        
        window.AetherState.quizzes.push(newQuiz);
        window.saveState();
        
        // Reset Creator Form
        quizTitleInput.value = '';
        quizCategoryInput.value = '';
        questionsBuilder.innerHTML = '';
        questionCounter = 0;
        addQuestionCard(); // Add blank question
        
        renderQuizzes();
        
        if (window.refreshReminderQuizDropdown) {
            window.refreshReminderQuizDropdown();
        }
        alert("Quiz created successfully!");
    });

    // Delete Quiz
    window.deleteQuiz = function(quizId, event) {
        if (event) event.stopPropagation();
        
        if (confirm("Are you sure you want to delete this quiz?")) {
            window.AetherState.quizzes = window.AetherState.quizzes.filter(q => q.id !== quizId);
            
            // Clean active recall reminders referencing this quiz
            window.AetherState.reminders.forEach(rem => {
                if (rem.quizId === quizId) {
                    if (rem._intervalId) clearInterval(rem._intervalId);
                }
            });
            window.AetherState.reminders = window.AetherState.reminders.filter(rem => rem.quizId !== quizId);
            
            window.saveState();
            renderQuizzes();
            
            if (window.refreshReminderQuizDropdown) {
                window.refreshReminderQuizDropdown();
            }
            if (window.renderReminders) {
                window.renderReminders();
            }
        }
    };

    // Open active quiz game mode
    window.playQuiz = function(quizId) {
        const quiz = window.AetherState.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        
        activePlayQuiz = quiz;
        playCurrentQIndex = 0;
        playScore = 0;
        playWrongAnswersReview = [];
        
        playTitle.innerText = quiz.title;
        playView.classList.remove('hidden');
        
        loadPlayQuestion(0);
    };

    playCloseBtn.addEventListener('click', () => {
        playView.classList.add('hidden');
        activePlayQuiz = null;
    });

    function loadPlayQuestion(index) {
        if (index >= activePlayQuiz.questions.length) {
            handleQuizPlayComplete();
            return;
        }
        
        const q = activePlayQuiz.questions[index];
        isQuestionAnswered = false;
        selectedOptionIndex = null;
        
        // Hide next button
        playNextBtn.classList.add('hidden');
        
        // Update display text
        playQCounter.innerText = `Question ${index + 1} of ${activePlayQuiz.questions.length}`;
        const pct = (index / activePlayQuiz.questions.length) * 100;
        playProgressBar.style.width = `${pct}%`;
        
        playQuestionText.innerText = q.question;
        
        // Render Options buttons
        playOptionsContainer.innerHTML = '';
        q.choices.forEach((choice, i) => {
            const prefix = ['A', 'B', 'C', 'D'][i];
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.innerHTML = `
                <span class="option-prefix">${prefix}</span>
                <span class="option-text">${escapeHTML(choice)}</span>
            `;
            
            btn.addEventListener('click', () => handleOptionClick(i, btn));
            playOptionsContainer.appendChild(btn);
        });
    }

    function handleOptionClick(optionIdx, buttonEl) {
        if (isQuestionAnswered) return;
        
        const q = activePlayQuiz.questions[playCurrentQIndex];
        isQuestionAnswered = true;
        selectedOptionIndex = optionIdx;
        
        const optionsButtons = playOptionsContainer.querySelectorAll('.quiz-option-btn');
        
        if (optionIdx === q.correctAnswer) {
            // Correct Answer
            playScore++;
            buttonEl.classList.add('correct');
            window.playChime('correct');
        } else {
            // Incorrect Answer
            buttonEl.classList.add('wrong');
            // Highlight the correct one
            optionsButtons[q.correctAnswer].classList.add('correct');
            window.playChime('wrong');
            
            // Record failure for final review list
            playWrongAnswersReview.push({
                question: q.question,
                yourAnswer: q.choices[optionIdx],
                correctAnswer: q.choices[q.correctAnswer]
            });
        }
        
        playNextBtn.classList.remove('hidden');
    }

    playNextBtn.addEventListener('click', () => {
        playCurrentQIndex++;
        loadPlayQuestion(playCurrentQIndex);
    });

    function handleQuizPlayComplete() {
        playView.classList.add('hidden');
        
        const scorePercent = Math.round((playScore / activePlayQuiz.questions.length) * 100);
        
        // Log to global quiz history stats
        window.AetherState.quizHistory.push({
            quizId: activePlayQuiz.id,
            scorePercent: scorePercent,
            date: new Date().toISOString()
        });
        window.saveState();
        
        // Populate Result screen
        resultTitle.innerText = activePlayQuiz.title;
        resultScoreRatio.innerText = `${playScore}/${activePlayQuiz.questions.length}`;
        resultScorePercent.innerText = `${scorePercent}%`;
        
        // Encourage messages
        if (scorePercent === 100) {
            resultScoreMsg.innerText = "🏆 Flawless victory! You have mastered this content thoroughly.";
        } else if (scorePercent >= 80) {
            resultScoreMsg.innerText = "🌟 Fantastic effort! You have solid command of this topic.";
        } else if (scorePercent >= 50) {
            resultScoreMsg.innerText = "📖 Good effort! Re-review the incorrect answers below to close gaps.";
        } else {
            resultScoreMsg.innerText = "📚 Don't worry! Failure is just feedback. Take a look at the corrections below and retry.";
        }
        
        // Populate review block
        resultReviewList.innerHTML = '';
        if (playWrongAnswersReview.length === 0) {
            resultReviewList.innerHTML = `<div style="font-size:13px; color:var(--color-reading);">Perfect score! No mistakes to review.</div>`;
        } else {
            playWrongAnswersReview.forEach(item => {
                const el = document.createElement('div');
                el.className = 'review-item';
                el.innerHTML = `
                    <div class="review-q">${escapeHTML(item.question)}</div>
                    <div style="color:var(--accent);">You: ${escapeHTML(item.yourAnswer)}</div>
                    <div class="review-ans">Correct: ${escapeHTML(item.correctAnswer)}</div>
                `;
                resultReviewList.appendChild(el);
            });
        }
        
        // Display result view overlay modal
        resultView.classList.remove('hidden');
        activePlayQuiz = null;
    }

    resultCloseBtn.addEventListener('click', () => {
        resultView.classList.add('hidden');
        renderQuizzes();
    });

    // Main Renderer
    function renderQuizzes() {
        const quizzes = window.AetherState.quizzes;
        quizzesGrid.innerHTML = '';
        
        if (quizzes.length === 0) {
            quizzesGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No quizzes available. Construct a quiz to get started!</div>`;
        } else {
            quizzes.forEach(quiz => {
                const card = document.createElement('div');
                card.className = 'quiz-card';
                card.addEventListener('click', () => playQuiz(quiz.id));
                
                card.innerHTML = `
                    <div class="quiz-info">
                        <h3>${escapeHTML(quiz.title)}</h3>
                        <span class="quiz-tag">${escapeHTML(quiz.category)}</span>
                        <p>Evaluate your mastery of key concepts.</p>
                    </div>
                    <div class="quiz-meta-row">
                        <span class="quiz-q-count">${quiz.questions.length} questions</span>
                        <button class="action-btn btn-delete-quiz" onclick="deleteQuiz('${quiz.id}', event)" title="Delete Quiz">
                            🗑️
                        </button>
                    </div>
                `;
                quizzesGrid.appendChild(card);
            });
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    window.renderQuizzes = renderQuizzes;

    document.addEventListener('DOMContentLoaded', () => {
        renderQuizzes();
    });
})();
