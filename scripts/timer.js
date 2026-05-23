let timers = []

let emojiOptions = [
    "⛴️",
    "🚤",
    "🚁",
    "✈️",
    "🚀",
]

let timersContainer = document.getElementById('timers-container');

function getRemainingSeconds(timer) {
    if (timer.expired) {
        return 0;
    }

    if (!timer.paused && timer.endTime) {
        return Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
    }

    return timer.timeLeft ?? timer.duration;
}

function saveLocal(){
    localStorage.setItem('timers', JSON.stringify(timers));
}

function playTimerAlarm() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.value = 0.1;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn('Alarm sound blocked or unsupported', e);
    }
}

function loadLocal(){
    const storedTimers = localStorage.getItem('timers');
    if (!storedTimers) return;

    const now = Date.now();
    timers = JSON.parse(storedTimers).map(timer => ({
        timerid: timer.timerid,
        name: timer.name,
        emoji: timer.emoji,
        duration: timer.duration ?? timer.time ?? 0,
        timeLeft: timer.timeLeft ?? timer.time ?? timer.duration ?? 0,
        endTime: timer.endTime ?? null,
        paused: typeof timer.paused === 'boolean' ? timer.paused : true,
        expired: typeof timer.expired === 'boolean' ? timer.expired : false,
        expiredAt: timer.expiredAt ?? null
    }));

    const expiredTimers = [];

    timers.forEach(timer => {
        if (!timer.paused && timer.endTime) {
            if (timer.endTime <= now) {
                timer.expired = true;
                timer.paused = true;
                timer.expiredAt = timer.expiredAt ?? timer.endTime;
                timer.timeLeft = 0;
                timer.endTime = null;
                expiredTimers.push(timer);
            }
        }

        if (timer.paused && timer.endTime) {
            timer.timeLeft = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
            timer.endTime = null;
        }

        if (timer.expired && !expiredTimers.includes(timer)) {
            timer.timeLeft = 0;
            timer.paused = true;
            expiredTimers.push(timer);
        }
    });

    renderTimers();

    if (expiredTimers.length > 0) {
        generateModal(expiredTimers);
        playTimerAlarm();
    }
}

loadLocal();

// Initialize start alignment UI from saved value and persist changes
;(function initStartAlign() {
    try {
        const saved = localStorage.getItem('startAlign');
        if (saved) {
            const el = document.querySelector(`input[name="startAlign"][value="${saved}"]`);
            if (el) el.checked = true;
        }

        document.querySelectorAll('input[name="startAlign"]').forEach(radio => {
            radio.addEventListener('change', function() {
                localStorage.setItem('startAlign', this.value);
            });
        });
    } catch (e) {
        // ignore in non-browser environments
    }
})();

function createCustomTimer() {
    // Open the custom timer modal instead of using prompt dialogs
    openCustomTimerModal();
}

// Custom Timer Modal handling
function openCustomTimerModal() {
    const modal = document.getElementById('customTimerModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    // populate emoji picker
    const picker = document.getElementById('customEmojiPicker');
    if (picker) {
        picker.innerHTML = '';
        emojiOptions.forEach(e => {
            const span = document.createElement('span');
            span.textContent = e;
            span.addEventListener('click', () => {
                const input = document.getElementById('customTimerEmoji');
                if (input) input.value = e;
            });
            picker.appendChild(span);
        });
    }
    // focus the name field
    const nameInput = document.getElementById('customTimerName');
    if (nameInput) nameInput.focus();
}

function closeCustomTimerModal() {
    const modal = document.getElementById('customTimerModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
}

function submitCustomTimerForm() {
    const name = (document.getElementById('customTimerName') || {}).value || 'Custom Timer';
    const emoji = (document.getElementById('customTimerEmoji') || {}).value || '⏲️';
    const hrs = parseInt((document.getElementById('customTimerHours') || {}).value || '0', 10) || 0;
    const mins = parseInt((document.getElementById('customTimerMinutes') || {}).value || '0', 10) || 0;
    const secs = parseInt((document.getElementById('customTimerSeconds') || {}).value || '0', 10) || 0;
    const total = hrs * 3600 + mins * 60 + secs;

    if (total <= 0) {
        alert('Please enter a duration greater than 0.');
        return;
    }

    createNewTimer(name, emoji, total);
    closeCustomTimerModal();
}

// Wire modal buttons if present
;(function initCustomTimerModal() {
    try {
        const createBtn = document.getElementById('createCustomTimerBtn');
        const cancelBtn = document.getElementById('cancelCustomTimerBtn');
        if (createBtn) createBtn.addEventListener('click', submitCustomTimerForm);
        if (cancelBtn) cancelBtn.addEventListener('click', closeCustomTimerModal);
        // close modal when clicking backdrop
        const modal = document.getElementById('customTimerModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeCustomTimerModal();
            });
        }

        // Spinner buttons for number inputs
        document.querySelectorAll('.spinner-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;
                const delta = btn.classList.contains('spinner-up') ? 1 : -1;
                const step = parseInt(input.step || '1', 10) || 1;
                const min = (input.min !== '') ? parseInt(input.min, 10) : null;
                let val = parseInt(input.value || '0', 10) || 0;
                val += delta * step;
                if (min !== null && val < min) val = min;
                input.value = val;
                input.dispatchEvent(new Event('input'));
            });
        });

        // No watermark logic needed; placeholders provide the preset text inside inputs.
    } catch (e) {
        // ignore in non-browser env
    }
})();

function getPreviousMinuteStart(now) {
    const start = new Date(now);
    start.setSeconds(0, 0);
    if (start.getTime() > now) {
        start.setMinutes(start.getMinutes() - 1);
    }
    return start.getTime();
}

function getNextMinuteStart(now) {
    const start = new Date(now);
    start.setSeconds(0, 0);
    if (start.getTime() <= now) {
        start.setMinutes(start.getMinutes() + 1);
    }
    return start.getTime();
}

function getNext30sStart(now) {
    const sec = Math.ceil(now / 1000);
    const nextMultiple = Math.ceil(sec / 30) * 30;
    return nextMultiple * 1000;
}

function getAlignedStart(now, mode) {
    switch (mode) {
        case 'prev':
            return getPreviousMinuteStart(now);
        case 'next':
            return getNextMinuteStart(now);
        case '30s':
            return getNext30sStart(now);
        case 'immediate':
        default:
            return now;
    }
}

function getSavedStartMode() {
    const saved = localStorage.getItem('startAlign');
    if (saved) return saved;
    const el = document.querySelector('input[name="startAlign"]:checked');
    return el ? el.value : 'immediate';
}

function createNewTimer(nm, e, t) {
    const now = Date.now();
    const mode = getSavedStartMode();
    const startTime = getAlignedStart(now, mode);
    const newTimer = {
        timerid: Date.now(),
        name: nm,
        emoji: e,
        duration: t,
        timeLeft: t,
        endTime: startTime + t * 1000,
        paused: false,
        expired: false,
        expiredAt: null
    };

    timers.push(newTimer);
    renderTimers();
    saveLocal();
}

function presetTimer(preset) {
    if (preset == 1) {
        createNewTimer("CG Cutter Timer", "⛴️", 14400);
    } else if (preset == 2) {
        createNewTimer("CG Fixed Wing Timer", "✈️", 1800);
    } else if (preset == 3) {
        createNewTimer("CG Small Boat Timer", "🚤", 1800);
    } else if (preset == 4) {
        createNewTimer("CG Rotary Wing Timer", "🚁", 900);
    }
}

function toggleTimer(currentTimer) {
    const now = Date.now();

    if (currentTimer.expired) {
        currentTimer.expired = false;
        currentTimer.expiredAt = null;
        currentTimer.timeLeft = currentTimer.duration;
        currentTimer.endTime = now + currentTimer.timeLeft * 1000;
        currentTimer.paused = false;
    } else if (currentTimer.paused) {
        currentTimer.endTime = now + (currentTimer.timeLeft ?? currentTimer.duration) * 1000;
        currentTimer.paused = false;
    } else {
        currentTimer.timeLeft = getRemainingSeconds(currentTimer);
        currentTimer.endTime = null;
        currentTimer.paused = true;
    }

    renderTimers();
    saveLocal();
}

function resetTimer(currentTimer) {
    currentTimer.expired = false;
    currentTimer.expiredAt = null;
    currentTimer.timeLeft = currentTimer.duration;
    currentTimer.endTime = null;
    currentTimer.paused = true;
    renderTimers();
    saveLocal();
}

function sortTimers() {
    const getRemainingTime = timer => getRemainingSeconds(timer) * 1000;

    const sortByTime = (a, b) => getRemainingTime(a) - getRemainingTime(b);

    const active = timers.filter(t => !t.paused && !t.expired).sort(sortByTime);
    const paused = timers.filter(t => t.paused && !t.expired).sort(sortByTime);
    const expired = timers.filter(t => t.expired);

    return [...active, ...paused, ...expired];
}

function removeTimer(currentTimer){
    let index = timers.findIndex(t => t.timerid === currentTimer.timerid);

    if (index !== -1) {
        timers.splice(index, 1);
        renderTimers();
        saveLocal();
    } else {
        console.log("Timer not found in the mission list.");
    }
}

function expireTimer(timer) {
    if (timer.expired) return;
    timer.expired = true;
    timer.expiredAt = timer.expiredAt || Date.now();
    timer.paused = true;
    timer.endTime = null;
    timer.timeLeft = 0;
    playTimerAlarm();
}

function checkExpiredTimers() {
    const now = Date.now();
    const expiredTimers = [];

    timers.forEach(timer => {
        if (!timer.paused && timer.endTime && timer.endTime <= now) {
            expireTimer(timer);
            expiredTimers.push(timer);
        }
    });

    if (expiredTimers.length > 0) {
        renderTimers();
        generateModal(expiredTimers);
        saveLocal();
    }
}

let lastTimestamp = 0;
let saveAccumulator = 0;

function timerLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;

    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    saveAccumulator += deltaTime;

    updateTimers();

    if (saveAccumulator >= 1000) {
        saveLocal();
        saveAccumulator -= 1000;
    }

    requestAnimationFrame(timerLoop);
}

function updateTimers() {
    if (timers.length === 0) return;

    timers.forEach(currentTimer => {
        if (currentTimer.timerTextElement) {
            currentTimer.timerTextElement.textContent = formatTime(getRemainingSeconds(currentTimer));
        }
    });

    checkExpiredTimers();
}

// Start the loop
requestAnimationFrame(timerLoop);

function formatTime(time) {
    // 1. Calculate total hours, minutes, and seconds directly
    const hr = Math.floor(time / 3600);
    const min = Math.floor((time % 3600) / 60);
    const sec = Math.floor(time % 60);

    // 2. Pad numbers with leading zeros (e.g., '9' becomes '09')
    const paddedMin = String(min).padStart(2, '0');
    const paddedSec = String(sec).padStart(2, '0');

    // 3. Return the formatted string conditionally
    if (hr > 0) {
        return `${hr}:${paddedMin}:${paddedSec}`;
    } else {
        return `${paddedMin}:${paddedSec}`;
    }
}

function renderTimers(){
    // Access the Timers Container Element
    timersContainer.innerHTML = ''; // nuke everything
    document.querySelectorAll('.emoji-menu').forEach(menu => menu.remove());

    const sortedTimers = sortTimers();

    for (let i = 0; i < sortedTimers.length; i++) {
        let currentTimer = sortedTimers[i];
        renderTimerCard(currentTimer);
    }

    // Hide container if no timers, show if timers exist
    if (timers.length === 0) {
        timersContainer.style.display = 'none';
    } else {
        timersContainer.style.display = 'flex';
    }
}

function renderTimerCard( currentTimer ){

    // create the timer card
    const timerCard = document.createElement("div");
    timerCard.classList.add("timer-card");
    timersContainer.appendChild(timerCard);
    
    // Create Title Div
    const titleDiv = document.createElement("div");
    titleDiv.classList.add("inline-div");
    timerCard.appendChild(titleDiv);

    // Emoji for title
    const timerEmoji = document.createElement("h1")
    timerEmoji.textContent = currentTimer.emoji;
    titleDiv.appendChild(timerEmoji);

    const emojiMenu = document.createElement("div");
    emojiMenu.classList.add("emoji-menu");
    emojiMenu.style.position = "absolute";
    document.body.appendChild(emojiMenu);

    for (let i = 0; i < emojiOptions.length; i++) {
        const element = emojiOptions[i];
        const emojiOption = document.createElement("span")
        emojiOption.classList.add("emoji-option")
        emojiOption.textContent = element
        emojiMenu.appendChild(emojiOption)
        
        // 3. Logic for Selecting a New Emoji
        emojiOption.addEventListener('click', () => {
            currentTimer.emoji = element;
            timerEmoji.textContent = element;
            emojiMenu.classList.remove('active'); // Hide menu after selection
        });
    }

    // 2. Logic for Toggling Emoji Menu
    timerEmoji.addEventListener('click', () => {
        // Calculate position when menu opens
        const rect = timerEmoji.getBoundingClientRect();
        emojiMenu.style.top = `${rect.top + window.scrollY + 50}px`;
        emojiMenu.style.left = `${rect.left + window.scrollX}px`;
        emojiMenu.classList.toggle('active');
    });

    // Close menu if user clicks anywhere else
    window.addEventListener('click', (e) => {
        if (!timerEmoji.contains(e.target) && !emojiMenu.contains(e.target)) {
            emojiMenu.classList.remove('active');
        }
    });

    // Name for title
    const timerName = document.createElement("h2");
    timerName.textContent = currentTimer.name;
    titleDiv.appendChild(timerName);

    timerName.addEventListener('click', () => {
        // Inline edit the timer name instead of using prompt
        if (currentTimer._editingName) return;
        currentTimer._editingName = true;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'timer-name-input';
        input.value = timerName.textContent;

        timerName.replaceWith(input);
        input.focus();
        input.select();

        function finishNameEditing(apply) {
            currentTimer._editingName = false;
            if (apply) {
                let newName = input.value.trim();
                if (newName === '') newName = 'Timer';
                newName = newName.slice(0, 40);
                currentTimer.name = newName;
            }
            saveLocal();
            renderTimers();
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishNameEditing(true);
            else if (e.key === 'Escape') finishNameEditing(false);
        });

        input.addEventListener('blur', () => finishNameEditing(true));
    });

    // Creating the start, reset, remove buttons
    const buttonDiv = document.createElement("div");
    buttonDiv.classList.add("inline-div");
    timerCard.appendChild(buttonDiv);

    const timerText = document.createElement("h2");
    timerText.classList.add("timer-text");
    currentTimer.timerTextElement = timerText;

    const timeleft = getRemainingSeconds(currentTimer);
    timerText.textContent = formatTime(timeleft);
    // Allow inline editing of remaining time by clicking the timer text
    timerText.addEventListener('click', () => {
        // Prevent multiple inputs
        if (currentTimer._editing) return;
        currentTimer._editing = true;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'timer-edit-input';
        input.value = formatTime(getRemainingSeconds(currentTimer));

        // Replace the text element with the input
        timerText.replaceWith(input);
        input.focus();
        input.select();

        function finishEditing(apply) {
            currentTimer._editing = false;
            // If apply true, parse and set time
            if (apply) {
                const parsed = parseTimeString(input.value.trim());
                if (parsed !== null) {
                    applyNewRemainingTime(currentTimer, parsed);
                }
            }
            // restore display
            timerText.textContent = formatTime(getRemainingSeconds(currentTimer));
            input.replaceWith(timerText);
            saveLocal();
            renderTimers();
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEditing(true);
            } else if (e.key === 'Escape') {
                finishEditing(false);
            }
        });

        // blur applies the change
        input.addEventListener('blur', () => finishEditing(true));
    });

    const toggleButton = document.createElement("button");
    toggleButton.classList.add("btn");
    currentTimer.toggleButtonElement = toggleButton;

    if (currentTimer.expired) {
        toggleButton.textContent = "Restart";
        toggleButton.classList.add("start-btn");
        toggleButton.classList.remove("pause-btn");
    } else if (currentTimer.paused) {
        toggleButton.textContent = "Start";
        toggleButton.classList.add("start-btn");
        toggleButton.classList.remove("pause-btn");
    } else {
        toggleButton.textContent = "Pause";
        toggleButton.classList.add("pause-btn");
        toggleButton.classList.remove("start-btn");
    }

    toggleButton.addEventListener('click', function() {
        toggleTimer(currentTimer);
    });

    const resetButton = document.createElement("button");
    resetButton.classList.add("reset-btn");
    resetButton.classList.add("btn");
    resetButton.textContent = "Reset";
    resetButton.addEventListener('click', function() {
        resetTimer(currentTimer);
    });

    const removeButton = document.createElement("button");
    removeButton.classList.add("remove-btn");
    removeButton.classList.add("btn");
    removeButton.textContent = "Remove";
    removeButton.addEventListener('click', function() {
        removeTimer(currentTimer);
    });

    const cursorobjects = [
        timerName,
        timerEmoji,
        resetButton,
        toggleButton,
        removeButton
    ]
    
    for (let i = 0; i < cursorobjects.length; i++) {
        const element = cursorobjects[i];
        
        Object.assign(element.style, {
            cursor: "pointer"
        });
    }
    
    buttonDiv.appendChild(timerText);
    buttonDiv.appendChild(toggleButton);
    buttonDiv.appendChild(resetButton);
    buttonDiv.appendChild(removeButton);
}

// Parse human time strings like "hh:mm:ss", "mm:ss", or "m:s" or "90" (seconds)
function parseTimeString(str) {
    if (!str) return null;
    // If only digits, treat as seconds
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10);
    }

    const parts = str.split(':').map(p => p.trim());
    if (parts.length === 0) return null;

    // Only mm:ss or hh:mm:ss supported
    if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const s = parseInt(parts[1], 10);
        if (Number.isNaN(m) || Number.isNaN(s)) return null;
        return m * 60 + s;
    }

    if (parts.length === 3) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(parts[2], 10);
        if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
        return h * 3600 + m * 60 + s;
    }

    return null;
}

function applyNewRemainingTime(timer, seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    // persist the edited value as the new duration so resets/restarts use it
    timer.duration = seconds;

    if (seconds === 0) {
        timer.expired = true;
        timer.expiredAt = timer.expiredAt || Date.now();
        timer.paused = true;
        timer.endTime = null;
        timer.timeLeft = 0;
        playTimerAlarm();
        return;
    }

    // non-zero: clear expired flag and set remaining time
    timer.expired = false;
    timer.timeLeft = seconds;

    if (!timer.paused) {
        // if running, update endTime to reflect new remaining seconds
        timer.endTime = Date.now() + seconds * 1000;
    } else {
        timer.endTime = null;
    }
}