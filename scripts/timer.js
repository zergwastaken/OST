let timers = []
let pastDueTimers = []

let emojiOptions = [
    "⛴️",
    "🚤",
    "🚁",
    "✈️",
    "🚀",
]

let timersContainer = document.getElementById('timers-container');

function createCustmomTimer() {
    let timerName = prompt("Enter a name for your timer:");
    let timerEmoji = prompt("Enter an emoji for your timer:");
    let timerTime = parseInt(prompt("Enter the duration for your timer (in seconds):"));

    if (timerName && timerEmoji && !isNaN(timerTime)) {
        createNewTimer(timerName, timerEmoji, timerTime);
    }
}

function createNewTimer( nm, e, t){
    timers.push ({name: nm, emoji: e, time: t, timeleft: t, paused: false, timerid: Date.now()});
    renderTimers(); 
}

function presetTimer(preset) {
    if (preset == 1) {
        createNewTimer("CG Cutter Timer", "⛴️", 14400);
    } else if (preset == 2){
        createNewTimer("CG Fixed Wing Timer", "✈️", 1800);
    } else if (preset == 3){
        createNewTimer("CG Small Boat Timer", "🚤", 1800);
    } else if (preset == 4){
        createNewTimer("CG Rotary Wing Timer", "🚁", 900);
    } 
}

function toggleTimer(currentTimer){
    if (currentTimer.paused) {
        currentTimer.paused = false;
        currentTimer.toggleButtonElement.textContent = "Pause";
    } else{
        currentTimer.paused = true;
        currentTimer.toggleButtonElement.textContent = "Start";
    }
    renderTimers()
}

function resetTimer(currentTimer){
    currentTimer.timeleft = currentTimer.time
    renderTimers()
}

function sortTimers() {
    const sortByTime = (a, b) => a.timeleft - b.timeleft;

    const active = timers.filter(t => !t.paused).sort(sortByTime);
    const paused = timers.filter(t => t.paused).sort(sortByTime);

    return [...active, ...paused];
}


function removeTimer(currentTimer){
    let index = timers.findIndex(t => t.timerid === currentTimer.timerid);

    if (index !== -1) {
        timers.splice(index, 1);
        renderTimers();
    } else {
        console.log("Timer not found in the mission list.");
    }
}

let lastTimestamp = 0;
let accumulator = 0;

function timerLoop(timestamp) {
    // Initialize lastTimestamp on the first execution
    if (!lastTimestamp) lastTimestamp = timestamp;

    // Calculate time passed since the last frame
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Accumulate time only if timers aren't globally paused
    accumulator += deltaTime;

    // Check if at least 1000ms (1 second) has passed
    if (accumulator >= 1000) {
        updateTimers();
        // Reset accumulator but keep the remainder for precision
        accumulator %= 1000;
    }

    requestAnimationFrame(timerLoop);
}

function updateTimers() {
    for (let i = 0; i < timers.length; i++) {
        let currentTimer = timers[i];
        if (!currentTimer.paused) {
            currentTimer.timeleft -= 1;
            currentTimer.timerTextElement.textContent = formatTime(currentTimer.timeleft);
        }
    }
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
        // Prompt the user for a new name
        let newName = prompt("Enter a new name for this timer:", timerName.textContent);
        
        // Check if the user didn't cancel and entered a value
        if (newName !== null && newName.trim() !== "") {
            newName = newName.slice(0, 20); 
            timerName.textContent = newName;
            currentTimer.name = newName;
        }
    });

    // Creating the start, reset, remove buttons
    const buttonDiv = document.createElement("div");
    buttonDiv.classList.add("inline-div");
    timerCard.appendChild(buttonDiv);

    const timerText = document.createElement("h2");
    timerText.classList.add("timer-text");
    currentTimer.timerTextElement = timerText;
    timerText.textContent = formatTime(currentTimer.timeleft);

    const toggleButton = document.createElement("button");
    toggleButton.classList.add("btn");
    currentTimer.toggleButtonElement = toggleButton;

    if (currentTimer.paused) {
        toggleButton.textContent = "Start";
        toggleButton.classList.add("start-btn");
        toggleButton.classList.remove("pause-btn");

    } else{
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




