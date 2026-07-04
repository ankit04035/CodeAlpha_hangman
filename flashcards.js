/* ==========================================================================
   Aether Study Planner - Flashcards Module (Spaced Repetition)
   ========================================================================== */

(function() {
    // DOM Elements
    const deckForm = document.getElementById('deck-form');
    const deckTitleInput = document.getElementById('deck-title');
    const deckDescInput = document.getElementById('deck-desc');
    const decksGrid = document.getElementById('decks-grid-container');
    
    const cardForm = document.getElementById('card-form');
    const cardDeckSelect = document.getElementById('card-deck-select');
    const cardFrontInput = document.getElementById('card-front');
    const cardBackInput = document.getElementById('card-back');
    
    // Study Mode Elements
    const studyView = document.getElementById('study-session-view');
    const studyCloseBtn = document.getElementById('study-close-btn');
    const studyDeckTitle = document.getElementById('study-deck-title');
    const studyProgressFill = document.getElementById('study-progress-fill');
    const studyCardCounter = document.getElementById('study-card-counter');
    
    const studyCardFlip = document.getElementById('flashcard-flip-element');
    const studyFrontText = document.getElementById('study-card-front-text');
    const studyBackText = document.getElementById('study-card-back-text');
    
    const revealActions = document.getElementById('study-reveal-actions');
    const revealBtn = document.getElementById('study-reveal-btn');
    const scoreActions = document.getElementById('study-score-actions');
    const scoreButtons = document.querySelectorAll('.btn-score');

    // Study session internal state
    let activeDeck = null;
    let activeCards = [];
    let currentCardIndex = 0;

    // Deck Creation
    deckForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = deckTitleInput.value.trim();
        const desc = deckDescInput.value.trim();
        
        if (!title) return;
        
        const newDeck = {
            id: 'deck_' + Date.now(),
            title: title,
            desc: desc,
            cards: []
        };
        
        window.AetherState.flashcards.decks.push(newDeck);
        window.saveState();
        
        deckTitleInput.value = '';
        deckDescInput.value = '';
        
        renderDecks();
    });

    // Flashcard Creation
    cardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const deckId = cardDeckSelect.value;
        const front = cardFrontInput.value.trim();
        const back = cardBackInput.value.trim();
        
        if (!deckId || !front || !back) return;
        
        const targetDeck = window.AetherState.flashcards.decks.find(d => d.id === deckId);
        if (targetDeck) {
            targetDeck.cards.push({
                front: front,
                back: back,
                difficulty: 'new', // spaced-rep indicator: 'easy', 'medium', 'hard', 'new'
                lastReviewed: null
            });
            window.saveState();
            
            // Reset fields
            cardFrontInput.value = '';
            cardBackInput.value = '';
            
            renderDecks();
            alert("Card added to deck successfully!");
        }
    });

    // Populate Target Decks Dropdown Select
    function refreshDeckDropdown() {
        const selectedValue = cardDeckSelect.value;
        cardDeckSelect.innerHTML = `<option value="" disabled selected>-- Select Deck --</option>`;
        
        window.AetherState.flashcards.decks.forEach(deck => {
            const opt = document.createElement('option');
            opt.value = deck.id;
            opt.innerText = deck.title;
            if (deck.id === selectedValue) {
                opt.selected = true;
            }
            cardDeckSelect.appendChild(opt);
        });
    }

    // Delete Deck
    window.deleteDeck = function(deckId, event) {
        if (event) event.stopPropagation(); // Avoid triggering any card click bindings
        
        if(confirm("Are you sure you want to delete this deck? All flashcards in it will be lost.")) {
            window.AetherState.flashcards.decks = window.AetherState.flashcards.decks.filter(d => d.id !== deckId);
            window.saveState();
            renderDecks();
        }
    };

    // Open Deck Study Mode Session
    window.startStudyDeck = function(deckId) {
        const deck = window.AetherState.flashcards.decks.find(d => d.id === deckId);
        if (!deck) return;
        
        if (deck.cards.length === 0) {
            alert("This deck is empty! Please add some flashcards first.");
            return;
        }
        
        activeDeck = deck;
        // Basic Spaced Repetition sorting logic: 
        // We order cards so that 'hard' cards show first, then 'new'/'medium', and 'easy' cards last.
        activeCards = [...deck.cards].sort((a, b) => {
            const diffMap = { 'hard': 1, 'new': 2, 'medium': 3, 'easy': 4 };
            return (diffMap[a.difficulty] || 2) - (diffMap[b.difficulty] || 2);
        });
        
        currentCardIndex = 0;
        
        // Show study overlay viewport
        studyDeckTitle.innerText = deck.title;
        studyView.classList.remove('hidden');
        
        loadCard(currentCardIndex);
    };

    // Close study session
    studyCloseBtn.addEventListener('click', () => {
        studyView.classList.add('hidden');
        activeDeck = null;
        activeCards = [];
        renderDecks();
    });

    // Flip card trigger
    studyCardFlip.addEventListener('click', () => {
        studyCardFlip.classList.toggle('flipped');
        
        // If flipped manually, toggle visible control buttons
        if (studyCardFlip.classList.contains('flipped')) {
            showScoreActions();
        } else {
            showRevealActions();
        }
    });

    revealBtn.addEventListener('click', () => {
        studyCardFlip.classList.add('flipped');
        showScoreActions();
    });

    function showRevealActions() {
        revealActions.classList.remove('hidden');
        scoreActions.classList.add('hidden');
    }

    function showScoreActions() {
        revealActions.classList.add('hidden');
        scoreActions.classList.remove('hidden');
    }

    // Load active card index data into overlay cards
    function loadCard(index) {
        if (index >= activeCards.length) {
            handleStudySessionComplete();
            return;
        }
        
        const card = activeCards[index];
        
        // Reset card flip transform state
        studyCardFlip.classList.remove('flipped');
        showRevealActions();
        
        // Populate text
        studyFrontText.innerText = card.front;
        studyBackText.innerText = card.back;
        
        // Update counters & progress
        studyCardCounter.innerText = `Card ${index + 1} of ${activeCards.length}`;
        const pct = ((index) / activeCards.length) * 100;
        studyProgressFill.style.width = `${pct}%`;
    }

    // Handle button scores (spaced repetition difficulty feedback)
    scoreButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const score = btn.getAttribute('data-score'); // 'easy', 'medium', 'hard'
            
            // Update actual card difficulty inside the deck
            const currentCard = activeCards[currentCardIndex];
            const originalCardRef = activeDeck.cards.find(c => c.front === currentCard.front && c.back === currentCard.back);
            
            if (originalCardRef) {
                originalCardRef.difficulty = score;
                originalCardRef.lastReviewed = new Date().toISOString();
            }
            
            // Increment overall focus metric
            window.AetherState.flashcards.reviewedCount++;
            window.saveState();
            
            // Move forward
            currentCardIndex++;
            loadCard(currentCardIndex);
        });
    });

    function handleStudySessionComplete() {
        studyProgressFill.style.width = `100%`;
        window.playChime('correct');
        alert("🎉 Deck session complete! Excellent work exercising your active recall.");
        studyView.classList.add('hidden');
        activeDeck = null;
        activeCards = [];
        renderDecks();
    }

    // Main Renderer
    function renderDecks() {
        const decks = window.AetherState.flashcards.decks;
        
        // Populate decks explorer grid
        decksGrid.innerHTML = '';
        if (decks.length === 0) {
            decksGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No study decks found. Start by creating a deck!</div>`;
        } else {
            decks.forEach(deck => {
                const el = document.createElement('div');
                el.className = 'deck-card';
                el.addEventListener('click', () => startStudyDeck(deck.id));
                
                el.innerHTML = `
                    <div class="deck-info">
                        <h3>${escapeHTML(deck.title)}</h3>
                        <p>${escapeHTML(deck.desc || 'No description provided.')}</p>
                    </div>
                    <div class="deck-meta">
                        <span class="deck-count">${deck.cards.length} cards</span>
                        <div class="deck-actions">
                            <button class="action-btn btn-delete-deck" onclick="deleteDeck('${deck.id}', event)" title="Delete Deck">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
                decksGrid.appendChild(el);
            });
        }
        
        // Refresh target dropdown in form
        refreshDeckDropdown();
    }

    // Escape HTML helper
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Expose renderer
    window.renderDecks = renderDecks;

    document.addEventListener('DOMContentLoaded', () => {
        renderDecks();
    });
})();
