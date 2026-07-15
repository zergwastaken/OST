let timers = [];
let emojiOptions = ["⛴️", "🚤", "🚁", "✈️", "🚀"];
let timersContainer = document.getElementById('timers-container');

function getRemainingSeconds(timer) {
    if (timer.expired) return 0;
    if (!timer.paused && timer.endTime) {
        return Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
    }
    return timer.timeLeft ?? timer.duration;
}

function saveLocal(){
    localStorage.setItem('timers', JSON.stringify(timers));
}

// Redirect the old function to the new system just in case your HTML calls it
function playTimerAlarm() {
    try { window.playActiveAlarm(); } catch(e) {}
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
        if (typeof generateModal === 'function') generateModal(expiredTimers);
        try { window.playActiveAlarm(); } catch(e) { console.warn("Autoplay blocked on load."); }
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

let lastTimestamp = 0; let saveAccumulator = 0;
function timerLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    saveAccumulator += deltaTime;
    updateTimers();
    if (saveAccumulator >= 1000) { saveLocal(); saveAccumulator -= 1000; }
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
        emojiOption.addEventListener('click', () => { currentTimer.emoji = element; timerEmoji.textContent = element; emojiMenu.classList.remove('active'); });
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

// =====================================================================
// DYNAMIC HEADLESS ALARM PLAYER (For Timer Page)
// =====================================================================

let audioCtx;
let masterGain; 
let alarmTimerID;
let isAlarmPlaying = false;

let alarmBpm = 130, alarmNextNoteTime = 0.0, alarmCurrentStep = 0, alarmCurrentLoop = 0, alarmMaxLoops = 3;
let alarmGrid = [];
const alarmInstruments = ['Tick', 'Beep', 'Ring', 'Laser', 'Coin', 'Blip', 'Kick', 'Snare', 'Clap', 'Closed Hat', 'Open Hat'];
const alarmStepsCount = 16;

const alarmDefaultPresets = {
    "Classic Digital": { type: 'beat', bpm: 130, loops: 3, pattern: { "Beep": [0, 2, 8, 10] } },
    "Mechanical Bell": { type: 'beat', bpm: 150, loops: 3, pattern: { "Ring": [0], "Tick": [0, 2, 4, 6, 8, 10, 12, 14] } },
    "Clock Tick": { type: 'beat', bpm: 60, loops: 2, pattern: { "Tick": [0, 4, 8, 12] } },
    "Timer Urgent": { type: 'beat', bpm: 160, loops: 3, pattern: { "Blip": [0, 2, 4, 6], "Laser": [0, 8] } },
    "Timer Win": { type: 'beat', bpm: 110, loops: 1, pattern: { "Coin": [0, 4, 8, 12], "Blip": [0, 1, 2, 3, 4, 5, 6, 7], "Clap": [0, 8] } },
    "Retro Boss": { type: 'beat', bpm: 150, loops: 2, pattern: { "Kick": [0, 3, 6, 8, 11, 14], "Snare": [4, 12], "Laser": [0, 8], "Blip": [2, 4, 6, 10, 12, 14] } },
    "House Beat": { type: 'beat', bpm: 125, loops: 2, pattern: { "Kick": [0, 4, 8, 12], "Clap": [4, 12], "Closed Hat": [2, 6, 10, 14], "Open Hat": [14] } }
};

// Background Audio Unlocker
document.addEventListener('click', function unlockAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    document.removeEventListener('click', unlockAudioContext);
}, { once: true });

function playTick(t) { const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(2500, t); gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.02); osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.02); }
function playBeep(t) { const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(2048, t); gain.gain.setValueAtTime(0.3, t); gain.gain.setValueAtTime(0.3, t + 0.1); gain.gain.linearRampToValueAtTime(0, t + 0.12); osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.12); }
function playRing(t) { const osc1 = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc1.type = 'sine'; osc2.type = 'sine'; osc1.frequency.setValueAtTime(1200, t); osc2.frequency.setValueAtTime(1250, t); gain.gain.setValueAtTime(0.6, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4); osc1.connect(gain); osc2.connect(gain); gain.connect(masterGain); osc1.start(t); osc2.start(t); osc1.stop(t + 0.4); osc2.stop(t + 0.4); }
function playLaser(t) { const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.15); gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15); osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.15); }
function playCoin(t) { const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(988, t); osc.frequency.setValueAtTime(1319, t + 0.08); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.2, t + 0.02); gain.gain.setValueAtTime(0.2, t + 0.08); gain.gain.linearRampToValueAtTime(0, t + 0.2); osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.2); }
function playBlip(t) { const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(440, t); gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.1); }
function playKick(t) { const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.connect(gain); gain.connect(masterGain); osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5); gain.gain.setValueAtTime(1, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5); osc.start(t); osc.stop(t + 0.5); }
function playSnare(t) { const bs = audioCtx.sampleRate * 0.5, buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate), data = buf.getChannelData(0); for (let i = 0; i < bs; i++) data[i] = Math.random() * 2 - 1; const noise = audioCtx.createBufferSource(); noise.buffer = buf; const filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 1000; const gain = audioCtx.createGain(); gain.gain.setValueAtTime(1, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2); noise.connect(filter).connect(gain).connect(masterGain); noise.start(t); const osc = audioCtx.createOscillator(), oscGain = audioCtx.createGain(); osc.type = 'triangle'; osc.connect(oscGain); oscGain.connect(masterGain); osc.frequency.setValueAtTime(250, t); oscGain.gain.setValueAtTime(0.5, t); oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.start(t); osc.stop(t + 0.2); }
function playClap(t) { const bs = audioCtx.sampleRate * 0.5, buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate), data = buf.getChannelData(0); for (let i = 0; i < bs; i++) data[i] = Math.random() * 2 - 1; const noise = audioCtx.createBufferSource(); noise.buffer = buf; const filter = audioCtx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1500; const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.8, t + 0.01); gain.gain.linearRampToValueAtTime(0, t + 0.04); gain.gain.linearRampToValueAtTime(0.7, t + 0.05); gain.gain.linearRampToValueAtTime(0, t + 0.08); gain.gain.linearRampToValueAtTime(0.6, t + 0.09); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3); noise.connect(filter).connect(gain).connect(masterGain); noise.start(t); }
function playHat(t, decay) { const bs = audioCtx.sampleRate * 0.5, buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate), data = buf.getChannelData(0); for (let i = 0; i < bs; i++) data[i] = Math.random() * 2 - 1; const noise = audioCtx.createBufferSource(); noise.buffer = buf; const filter = audioCtx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 10000; const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + decay); noise.connect(filter).connect(gain).connect(masterGain); noise.start(t); }
function playClosedHat(t) { playHat(t, 0.05); }
function playOpenHat(t) { playHat(t, 0.3); }

const alarmSoundMakers = [playTick, playBeep, playRing, playLaser, playCoin, playBlip, playKick, playSnare, playClap, playClosedHat, playOpenHat];

// --- 🛑 INSTANT AUDIO KILL SWITCH ---
window.stopActiveAlarm = function() {
    isAlarmPlaying = false;
    clearTimeout(alarmTimerID);
    
    // Stop Synth Engine Instantly (Physical Disconnect)
    if (masterGain) {
        try { masterGain.disconnect(); } catch(e) {} // Unplugs virtual speakers
    }
    if (audioCtx && audioCtx.state === 'running') {
        try { audioCtx.suspend(); } catch(e) {} // Freezes audio clock instantly
    }
};

function alarmNextNote() {
    alarmNextNoteTime += 0.25 * (60.0 / alarmBpm);
    alarmCurrentStep++;
    if (alarmCurrentStep === alarmStepsCount) {
        alarmCurrentStep = 0; 
        alarmCurrentLoop++;
        if (alarmCurrentLoop >= alarmMaxLoops) {
            window.stopActiveAlarm(); 
            return false; 
        }
    }
    return true;
}

function alarmScheduler() {
    while (alarmNextNoteTime < audioCtx.currentTime + 0.1 && isAlarmPlaying) {
        const stepNum = alarmCurrentStep;
        alarmInstruments.forEach((_, trackIndex) => { 
            if (alarmGrid[trackIndex][stepNum]) alarmSoundMakers[trackIndex](alarmNextNoteTime); 
        });
        if (!alarmNextNote()) break; 
    }
    if (isAlarmPlaying) alarmTimerID = setTimeout(alarmScheduler, 25.0);
}

window.playActiveAlarm = function() {
    if (isAlarmPlaying) window.stopActiveAlarm();

    let activeName = localStorage.getItem('os_tools_active_beat') || "Classic Digital";
    const saves = JSON.parse(localStorage.getItem('os_tools_beats')) || {};

    if (!saves[activeName] && !alarmDefaultPresets[activeName]) {
        activeName = "Classic Digital"; 
        localStorage.setItem('os_tools_active_beat', activeName);
    }
    
    const p = saves[activeName] || alarmDefaultPresets[activeName];
    isAlarmPlaying = true;

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // We must resume the context since stopActiveAlarm() suspends it!
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn("Audio Context locked. Needs user click."));
    }
    
    // Clean up old masterGain and plug it back in
    if (masterGain) {
        try { masterGain.disconnect(); } catch(e){}
    }
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 1;
    
    alarmBpm = p.bpm || 130;
    alarmMaxLoops = Math.max(1, Math.min(parseInt(p.loops) || 3, 3));
    
    alarmGrid = alarmInstruments.map(() => Array(alarmStepsCount).fill(false));
    if (p.pattern) {
        for (const [instName, steps] of Object.entries(p.pattern)) {
            const instIndex = alarmInstruments.indexOf(instName);
            if (instIndex !== -1) steps.forEach(step => alarmGrid[instIndex][step] = true);
        }
    }
    
    alarmCurrentLoop = 0; alarmCurrentStep = 0; 
    alarmNextNoteTime = audioCtx.currentTime + 0.05;
    alarmScheduler();
};
