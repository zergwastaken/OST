let timers = [];
let emojiOptions = ["⛴️", "🚤", "🚁", "✈️", "🚀"];
let timersContainer = document.getElementById('timers-container');
const timerStorageKey = 'timers';

function setTimerStorageStatus(message) {
    const status = document.getElementById('timerStorageStatus');
    if (status) status.textContent = message;
}

function getRemainingSeconds(timer) {
    if (timer.expired) return 0;
    if (!timer.paused && timer.endTime) {
        return Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
    }
    return timer.timeLeft ?? timer.duration;
}

function saveLocal() {
    try {
        localStorage.setItem(timerStorageKey, JSON.stringify(timers));
        setTimerStorageStatus('');
        return true;
    } catch (error) {
        console.error('Could not save timers to browser storage.', error);
        setTimerStorageStatus('Timer storage is unavailable. Timers may not survive closing this tab.');
        return false;
    }
}

// Redirect the old function to the new system just in case your HTML calls it
function playTimerAlarm() {
    try { window.playActiveAlarm(); } catch(e) {}
}

function normalizeStoredTimers(storedTimers) {
    const now = Date.now();
    const loadedTimers = (Array.isArray(storedTimers) ? storedTimers : []).map(timer => ({
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
    loadedTimers.forEach(timer => {
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

    return { timers: loadedTimers, expiredTimers };
}

function loadLocal() {
    let storedTimers;
    try {
        storedTimers = localStorage.getItem(timerStorageKey);
        if (storedTimers === null) return;
        const loaded = normalizeStoredTimers(JSON.parse(storedTimers));
        timers = loaded.timers;
        renderTimers();
        if (loaded.expiredTimers.length > 0) {
            if (typeof generateModal === 'function') generateModal(loaded.expiredTimers);
            try { window.playActiveAlarm(); } catch(e) { console.warn("Autoplay blocked on load."); }
        }
    } catch (error) {
        console.error('Could not load saved timers from browser storage.', error);
        setTimerStorageStatus('Saved timers could not be read. Browser storage may be blocked or corrupted.');
    }
}

// Timers use an absolute end time, so their countdown continues while this tab is closed.
// Keep open timer tabs in sync without periodically overwriting the saved timer list.
window.addEventListener('storage', event => {
    if (event.key !== timerStorageKey && event.key !== null) return;

    try {
        if (event.key === null || event.newValue === null) {
            timers = [];
        } else {
            timers = normalizeStoredTimers(JSON.parse(event.newValue)).timers;
        }
        renderTimers();
    } catch (error) {
        console.error('Could not synchronize timers from another tab.', error);
        setTimerStorageStatus('Timer changes from another tab could not be synchronized.');
    }
});

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
    } catch (e) {}
})();

function createCustomTimer() { openCustomTimerModal(); }

// Custom Timer Modal handling
function openCustomTimerModal() {
    const modal = document.getElementById('customTimerModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
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

;(function initCustomTimerModal() {
    try {
        const createBtn = document.getElementById('createCustomTimerBtn');
        const cancelBtn = document.getElementById('cancelCustomTimerBtn');
        if (createBtn) createBtn.addEventListener('click', submitCustomTimerForm);
        if (cancelBtn) cancelBtn.addEventListener('click', closeCustomTimerModal);
        
        const modal = document.getElementById('customTimerModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeCustomTimerModal();
            });
        }
        
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
    } catch (e) {}
})();

function getPreviousMinuteStart(now) { const start = new Date(now); start.setSeconds(0, 0); if (start.getTime() > now) start.setMinutes(start.getMinutes() - 1); return start.getTime(); }
function getNextMinuteStart(now) { const start = new Date(now); start.setSeconds(0, 0); if (start.getTime() <= now) start.setMinutes(start.getMinutes() + 1); return start.getTime(); }
function getNext30sStart(now) { const sec = Math.ceil(now / 1000); const nextMultiple = Math.ceil(sec / 30) * 30; return nextMultiple * 1000; }
function getAlignedStart(now, mode) {
    switch (mode) {
        case 'prev': return getPreviousMinuteStart(now);
        case 'next': return getNextMinuteStart(now);
        case '30s': return getNext30sStart(now);
        case 'immediate': default: return now;
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
    const newTimer = { timerid: Date.now(), name: nm, emoji: e, duration: t, timeLeft: t, endTime: startTime + t * 1000, paused: false, expired: false, expiredAt: null };
    timers.push(newTimer);
    renderTimers();
    saveLocal();
}

function presetTimer(preset) {
    if (preset == 1) createNewTimer("CG Cutter Timer", "⛴️", 14400);
    else if (preset == 2) createNewTimer("CG Fixed Wing Timer", "✈️", 1800);
    else if (preset == 3) createNewTimer("CG Small Boat Timer", "🚤", 1800);
    else if (preset == 4) createNewTimer("CG Rotary Wing Timer", "🚁", 900);
}

function toggleTimer(currentTimer) {
    const now = Date.now();
    if (currentTimer.expired) {
        currentTimer.expired = false; currentTimer.expiredAt = null; currentTimer.timeLeft = currentTimer.duration;
        currentTimer.endTime = now + currentTimer.timeLeft * 1000; currentTimer.paused = false;
        try { window.stopActiveAlarm(); } catch(e) {}
    } else if (currentTimer.paused) {
        currentTimer.endTime = now + (currentTimer.timeLeft ?? currentTimer.duration) * 1000; currentTimer.paused = false;
    } else {
        currentTimer.timeLeft = getRemainingSeconds(currentTimer); currentTimer.endTime = null; currentTimer.paused = true;
    }
    renderTimers(); saveLocal();
}

function resetTimer(currentTimer) {
    currentTimer.expired = false; currentTimer.expiredAt = null; currentTimer.timeLeft = currentTimer.duration; currentTimer.endTime = null; currentTimer.paused = true;
    renderTimers(); saveLocal();
    try { window.stopActiveAlarm(); } catch(e) {}
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
        try { window.stopActiveAlarm(); } catch(e) {}
    }
}

function expireTimer(timer) {
    if (timer.expired) return;
    timer.expired = true;
    timer.expiredAt = timer.expiredAt || Date.now();
    timer.paused = true;
    timer.endTime = null;
    timer.timeLeft = 0;
    
    try { window.playActiveAlarm(); } catch(e) { console.error("Alarm error:", e); }
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
        if (typeof generateModal === 'function') generateModal(expiredTimers);
        saveLocal();
    }
}

function timerLoop() {
    updateTimers();
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

requestAnimationFrame(timerLoop);

function formatTime(time) {
    const hr = Math.floor(time / 3600);
    const min = Math.floor((time % 3600) / 60);
    const sec = Math.floor(time % 60);
    const paddedMin = String(min).padStart(2, '0');
    const paddedSec = String(sec).padStart(2, '0');
    return hr > 0 ? `${hr}:${paddedMin}:${paddedSec}` : `${paddedMin}:${paddedSec}`;
}

function renderTimers(){
    timersContainer.innerHTML = ''; 
    document.querySelectorAll('.emoji-menu').forEach(menu => menu.remove());
    const sortedTimers = sortTimers();
    for (let i = 0; i < sortedTimers.length; i++) renderTimerCard(sortedTimers[i]);
    timersContainer.style.display = timers.length === 0 ? 'none' : 'flex';
}

function renderTimerCard(currentTimer){
    const timerCard = document.createElement("div"); timerCard.classList.add("timer-card"); timersContainer.appendChild(timerCard);
    const titleDiv = document.createElement("div"); titleDiv.classList.add("inline-div"); timerCard.appendChild(titleDiv);
    
    const timerEmoji = document.createElement("h1"); timerEmoji.textContent = currentTimer.emoji; titleDiv.appendChild(timerEmoji);
    const emojiMenu = document.createElement("div"); emojiMenu.classList.add("emoji-menu"); emojiMenu.style.position = "absolute"; document.body.appendChild(emojiMenu);
    
    for (let i = 0; i < emojiOptions.length; i++) {
        const element = emojiOptions[i];
        const emojiOption = document.createElement("span"); emojiOption.classList.add("emoji-option"); emojiOption.textContent = element;
        emojiMenu.appendChild(emojiOption);
        emojiOption.addEventListener('click', () => {
            currentTimer.emoji = element;
            timerEmoji.textContent = element;
            emojiMenu.classList.remove('active');
            saveLocal();
        });
    }
    
    timerEmoji.addEventListener('click', () => {
        const rect = timerEmoji.getBoundingClientRect();
        emojiMenu.style.top = `${rect.top + window.scrollY + 50}px`; emojiMenu.style.left = `${rect.left + window.scrollX}px`;
        emojiMenu.classList.toggle('active');
    });
    
    window.addEventListener('click', (e) => { if (!timerEmoji.contains(e.target) && !emojiMenu.contains(e.target)) emojiMenu.classList.remove('active'); });
    
    const timerName = document.createElement("h2"); timerName.textContent = currentTimer.name; titleDiv.appendChild(timerName);
    timerName.addEventListener('click', () => {
        if (currentTimer._editingName) return;
        currentTimer._editingName = true;
        const input = document.createElement('input'); input.type = 'text'; input.className = 'timer-name-input'; input.value = timerName.textContent;
        timerName.replaceWith(input); input.focus(); input.select();
        
        function finishNameEditing(apply) {
            currentTimer._editingName = false;
            if (apply) {
                let newName = input.value.trim();
                if (newName === '') newName = 'Timer';
                newName = newName.slice(0, 40); currentTimer.name = newName;
            }
            saveLocal(); renderTimers();
        }
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finishNameEditing(true); else if (e.key === 'Escape') finishNameEditing(false); });
        input.addEventListener('blur', () => finishNameEditing(true));
    });
    
    const buttonDiv = document.createElement("div"); buttonDiv.classList.add("inline-div"); timerCard.appendChild(buttonDiv);
    const timerText = document.createElement("h2"); timerText.classList.add("timer-text"); currentTimer.timerTextElement = timerText;
    const timeleft = getRemainingSeconds(currentTimer); timerText.textContent = formatTime(timeleft);
    
    timerText.addEventListener('click', () => {
        if (currentTimer._editing) return;
        currentTimer._editing = true;
        
        // 1. Capture the exact initial string so we have something to check against
        const initialText = formatTime(getRemainingSeconds(currentTimer));
        
        const input = document.createElement('input'); 
        input.type = 'text'; 
        input.className = 'timer-edit-input'; 
        input.value = initialText;
        
        timerText.replaceWith(input); 
        input.focus(); 
        input.select();
        
        function finishEditing(apply) {
            currentTimer._editing = false;
            
            // 2. Fail-safe: Only apply the change if the text was actually modified
            if (apply && input.value.trim() !== initialText) {
                const parsed = parseTimeString(input.value.trim());
                if (parsed !== null) applyNewRemainingTime(currentTimer, parsed);
            }
            
            timerText.textContent = formatTime(getRemainingSeconds(currentTimer)); 
            input.replaceWith(timerText); 
            saveLocal(); 
            renderTimers();
        }
        
        input.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') finishEditing(true); 
            else if (e.key === 'Escape') finishEditing(false); 
        });
        
        input.addEventListener('blur', () => finishEditing(true));
    });
    
    const toggleButton = document.createElement("button"); toggleButton.classList.add("btn"); currentTimer.toggleButtonElement = toggleButton;
    if (currentTimer.expired) { toggleButton.textContent = "Restart"; toggleButton.classList.add("start-btn"); toggleButton.classList.remove("pause-btn"); } 
    else if (currentTimer.paused) { toggleButton.textContent = "Start"; toggleButton.classList.add("start-btn"); toggleButton.classList.remove("pause-btn"); } 
    else { toggleButton.textContent = "Pause"; toggleButton.classList.add("pause-btn"); toggleButton.classList.remove("start-btn"); }
    
    toggleButton.addEventListener('click', function() { toggleTimer(currentTimer); });
    const resetButton = document.createElement("button"); resetButton.classList.add("reset-btn", "btn"); resetButton.textContent = "Reset"; resetButton.addEventListener('click', function() { resetTimer(currentTimer); });
    const removeButton = document.createElement("button"); removeButton.classList.add("remove-btn", "btn"); removeButton.textContent = "Remove"; removeButton.addEventListener('click', function() { removeTimer(currentTimer); });
    
    [timerName, timerEmoji, resetButton, toggleButton, removeButton].forEach(el => Object.assign(el.style, { cursor: "pointer" }));
    buttonDiv.appendChild(timerText); buttonDiv.appendChild(toggleButton); buttonDiv.appendChild(resetButton); buttonDiv.appendChild(removeButton);
}

function parseTimeString(str) {
    if (!str) return null;
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    const parts = str.split(':').map(p => p.trim());
    if (parts.length === 0) return null;
    if (parts.length === 2) { const m = parseInt(parts[0], 10), s = parseInt(parts[1], 10); if (Number.isNaN(m) || Number.isNaN(s)) return null; return m * 60 + s; }
    if (parts.length === 3) { const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10), s = parseInt(parts[2], 10); if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null; return h * 3600 + m * 60 + s; }
    return null;
}

function applyNewRemainingTime(timer, seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    timer.duration = seconds;
    if (seconds === 0) {
        timer.expired = true; timer.expiredAt = timer.expiredAt || Date.now(); timer.paused = true; timer.endTime = null; timer.timeLeft = 0;
        try { window.playActiveAlarm(); } catch(e) {}
        return;
    }
    timer.expired = false; timer.timeLeft = seconds;
    if (!timer.paused) timer.endTime = Date.now() + seconds * 1000;
    else timer.endTime = null;
}

// =====================================================================
// CUSTOM ALARM LOGIC (Specific Time of Day)
// =====================================================================

function createCustomAlarm() {
    const modal = document.getElementById('customAlarmModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    
    const timeInput = document.getElementById('customAlarmTime');
    if (timeInput) timeInput.focus();
}

function closeCustomAlarmModal() {
    const modal = document.getElementById('customAlarmModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
}

function submitCustomAlarmForm() {
    const name = (document.getElementById('customAlarmName') || {}).value || 'Alarm';
    const emoji = (document.getElementById('customAlarmEmoji') || {}).value || '⏰';
    const timeInput = document.getElementById('customAlarmTime');
    
    if (!timeInput || !timeInput.value) {
        alert('Please select a valid time.');
        return;
    }

    // 1. Parse the selected target time
    const [hours, minutes] = timeInput.value.split(':').map(Number);
    const now = new Date();
    const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

    // 2. If the selected time has already passed today, set it for tomorrow
    if (targetTime.getTime() <= now.getTime()) {
        targetTime.setDate(targetTime.getDate() + 1);
    }

    // 3. Calculate total duration in seconds
    const totalSeconds = Math.ceil((targetTime.getTime() - now.getTime()) / 1000);

    // 4. Create the timer (bypassing the 'alignment' logic to ensure exact firing)
    const newTimer = {
        timerid: Date.now(),
        name: name,
        emoji: emoji,
        duration: totalSeconds,
        timeLeft: totalSeconds,
        endTime: targetTime.getTime(), 
        paused: false,
        expired: false,
        expiredAt: null
    };
    
    timers.push(newTimer);
    renderTimers();
    saveLocal();
    closeCustomAlarmModal();
}

// 5. Wire up the Modal Buttons
;(function initCustomAlarmModal() {
    try {
        const createBtn = document.getElementById('createCustomAlarmBtn');
        const cancelBtn = document.getElementById('cancelCustomAlarmBtn');
        if (createBtn) createBtn.addEventListener('click', submitCustomAlarmForm);
        if (cancelBtn) cancelBtn.addEventListener('click', closeCustomAlarmModal);
        
        const modal = document.getElementById('customAlarmModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeCustomAlarmModal();
            });
        }
    } catch (e) {}
})();

// Timer alarm sounds are listed in audio/timer_sounds/sounds.json.
const timerSoundCatalogPath = 'audio/timer_sounds/sounds.json';
const timerSoundStorageKey = 'timerAlarmSound';
const fallbackTimerSounds = [
    { name: 'Alarm', src: 'audio/timer_sounds/alarm.mp3' },
    { name: 'Quack', src: 'audio/timer_sounds/quack.m4a' },
    { name: 'Shleep', src: 'audio/timer_sounds/shleep.m4a' }
];
let timerAlarmSounds = [];
let activeAlarmAudio = null;
let previewAlarmAudio = null;
let timerAudioUnlocked = false;
let isTimerSoundPreviewPlaying = false;

function setPreviewButtonState(isPlaying) {
    const button = document.getElementById('previewTimerSoundBtn');
    if (!button) return;
    button.textContent = isPlaying ? '■ Stop' : '▶ Preview';
    button.setAttribute('aria-pressed', String(isPlaying));
}

function unlockTimerAudio() {
    if (timerAudioUnlocked) return;
    const audio = new Audio(getSelectedTimerSound());
    audio.muted = true;
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        timerAudioUnlocked = true;
    }).catch(() => {
        // The preview button remains available if the browser rejects muted playback.
    });
}

function setTimerSoundOptions(sounds) {
    const picker = document.getElementById('timerSoundSelect');
    if (!picker) return;

    const savedSound = localStorage.getItem(timerSoundStorageKey);
    picker.innerHTML = '';
    timerAlarmSounds = sounds;

    sounds.forEach(sound => {
        const option = document.createElement('option');
        option.value = sound.src;
        option.textContent = sound.name;
        picker.appendChild(option);
    });

    if (sounds.length === 0) {
        picker.add(new Option('No audio files found', ''));
        return;
    }

    picker.value = sounds.some(sound => sound.src === savedSound) ? savedSound : sounds[0].src;
    localStorage.setItem(timerSoundStorageKey, picker.value);
}

async function loadTimerSoundOptions() {
    const manifestUrl = new URL(timerSoundCatalogPath, document.baseURI);
    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error(`Sound list request failed: ${response.status}`);
        const entries = await response.json();
        if (!Array.isArray(entries)) throw new Error('Sound list must be a JSON array.');

        const sounds = entries
            .filter(entry => entry && typeof entry.name === 'string' && typeof entry.src === 'string')
            .map(entry => ({ name: entry.name, src: new URL(entry.src, response.url).href }));
        setTimerSoundOptions(sounds);
    } catch (error) {
        console.warn('Could not load timer sound list; using built-in sound paths.', error);
        setTimerSoundOptions(fallbackTimerSounds.map(sound => ({
            name: sound.name,
            src: new URL(sound.src, document.baseURI).href
        })));
    }
}

function getSelectedTimerSound() {
    const picker = document.getElementById('timerSoundSelect');
    return (picker && picker.value) || localStorage.getItem(timerSoundStorageKey) ||
        new URL(fallbackTimerSounds[0].src, document.baseURI).href;
}

window.stopActiveAlarm = function() {
    [activeAlarmAudio, previewAlarmAudio].forEach(audio => {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
    });
    activeAlarmAudio = null;
    previewAlarmAudio = null;
    isTimerSoundPreviewPlaying = false;
    setPreviewButtonState(false);
};

window.playActiveAlarm = function() {
    window.stopActiveAlarm();
    activeAlarmAudio = new Audio(getSelectedTimerSound());
    activeAlarmAudio.loop = true;
    activeAlarmAudio.addEventListener('error', () => {
    }, { once: true });
    activeAlarmAudio.play().then(() => {
    }).catch(error => {
        console.warn('Timer alarm playback was blocked or the sound could not be loaded.', error);
    });
};

;(function initTimerSoundPicker() {
    const picker = document.getElementById('timerSoundSelect');
    const previewButton = document.getElementById('previewTimerSoundBtn');

    if (picker) {
        picker.addEventListener('change', () => {
            localStorage.setItem(timerSoundStorageKey, picker.value);
            if (isTimerSoundPreviewPlaying && previewAlarmAudio) {
                previewAlarmAudio.pause();
                previewAlarmAudio.currentTime = 0;
                previewAlarmAudio = null;
                isTimerSoundPreviewPlaying = false;
                setPreviewButtonState(false);
            }
        });
    }

    if (previewButton) {
        previewButton.addEventListener('click', () => {
            if (isTimerSoundPreviewPlaying) {
                window.stopActiveAlarm();
                return;
            }

            window.stopActiveAlarm();
            isTimerSoundPreviewPlaying = true;
            setPreviewButtonState(true);
            previewAlarmAudio = new Audio(getSelectedTimerSound());
            previewAlarmAudio.loop = true;
            previewAlarmAudio.addEventListener('error', () => {
                window.stopActiveAlarm();
            }, { once: true });
            previewAlarmAudio.play().then(() => {
            }).catch(error => {
                window.stopActiveAlarm();
                console.warn('Timer sound preview could not be played.', error);
            });
        });
    }

    document.addEventListener('click', unlockTimerAudio, { once: true });
    loadTimerSoundOptions();
})();
