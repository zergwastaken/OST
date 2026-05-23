let expiredTimers = [];

// Get the modal
const modal = document.getElementById("myModal");


// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if (event.target == modal) {
		modal.style.display = "none";
	}
}

var generateModal = function(array){
    const newTimers = array.filter(timer => !expiredTimers.some(existing => existing.timerid === timer.timerid));
    expiredTimers = expiredTimers.concat(newTimers);
    modal.style.display = "flex";
	// Access the Timers Container Element
    modal.innerHTML = ''; // nuke everything

    for (let i = 0; i < expiredTimers.length; i++) {
        let currentTimer = expiredTimers[i];
        createExpiredTimerCard(currentTimer);
    }

    // Hide container if no timers, show if timers exist
    if (expiredTimers.length === 0) {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
    }
}

// Update modal timers every second to show elapsed time
setInterval(() => {
    expiredTimers.forEach(timer => {
        if (timer.timerModalTextElement && timer.expiredAt) {
            const timeBehind = Date.now() - timer.expiredAt;
            timer.timerModalTextElement.textContent = formatNegativeTime(timeBehind);
        }
    });
}, 1000);

function formatNegativeTime(timeBehind) {
    // timeBehind is in milliseconds (negative = behind)
    const totalSeconds = Math.floor(timeBehind / 1000);
    const hr = Math.floor(Math.abs(totalSeconds) / 3600);
    const min = Math.floor((Math.abs(totalSeconds) % 3600) / 60);
    const sec = Math.floor(Math.abs(totalSeconds) % 60);

    const paddedMin = String(min).padStart(2, '0');
    const paddedSec = String(sec).padStart(2, '0');

    if (hr > 0) {
        return `-${hr}:${paddedMin}:${paddedSec}`;
    } else {
        return `-${paddedMin}:${paddedSec}`;
    }
}

checkExpiredTimers = function() {
	if (expiredTimers.length < 1) {
		modal.style.display = "none";
	}
}

function createExpiredTimerCard( currentTimer ){

    // create the timer card
    const timerCard = document.createElement("div");
    timerCard.classList.add("overduetimer");
    modal.appendChild(timerCard);
    
    // Emoji for title
    const timerEmoji = document.createElement("h1")
    timerEmoji.textContent = currentTimer.emoji;
    timerCard.appendChild(timerEmoji);

    // Name for title
    const timerName = document.createElement("h2");
    timerName.textContent = currentTimer.name;
    timerCard.appendChild(timerName);

    // Creating the start, reset, remove buttons
    const buttonDiv = document.createElement("div");
    buttonDiv.classList.add("timer-controls");
    timerCard.appendChild(buttonDiv);

    const timerText = document.createElement("h2");
    timerText.classList.add("timer-text");
    currentTimer.timerModalTextElement = timerText;
    // Show negative time (how much behind/overdue)
    const timeBehind = Date.now() - (currentTimer.expiredAt || Date.now());
    timerText.textContent = formatNegativeTime(timeBehind);

    const restartButton = document.createElement("button");
    restartButton.classList.add("btn");
	restartButton.classList.add("start-btn");
	restartButton.textContent = "Restart";
    restartButton.addEventListener('click', function() {
        // Move back to active timers and restart
        let index = expiredTimers.indexOf(currentTimer);
        if (index !== -1) {
            expiredTimers.splice(index, 1);
            // timers.push(currentTimer);
            toggleTimer(currentTimer);
            modal.innerHTML = ''; // Clear modal
            if (expiredTimers.length > 0) {
                generateModal(expiredTimers);
            } else {
                modal.style.display = "none";
            }
            renderTimers();
        }
    });

    const resetButton = document.createElement("button");
    resetButton.classList.add("reset-btn");
    resetButton.classList.add("btn");
    resetButton.textContent = "Reset";
    resetButton.addEventListener('click', function() {
        // Reset and move back to active timers
        let index = expiredTimers.indexOf(currentTimer);
        if (index !== -1) {
            expiredTimers.splice(index, 1);
            // Clear expired state and reset timer state so it persists
            currentTimer.expired = false;
            currentTimer.expiredAt = null; // Clear expired time
            currentTimer.timeLeft = currentTimer.duration ?? currentTimer.time ?? 0;
            currentTimer.endTime = null;
            currentTimer.paused = true;
            // timers.push(currentTimer);
            modal.innerHTML = ''; // Clear modal
            if (expiredTimers.length > 0) {
                generateModal(expiredTimers);
            } else {
                modal.style.display = "none";
            }
            renderTimers();
            // Persist the updated timers state so the reset survives a reload
            if (typeof saveLocal === 'function') saveLocal();
        }
    });

    const removeButton = document.createElement("button");
    removeButton.classList.add("remove-btn");
    removeButton.classList.add("btn");
    removeButton.textContent = "Remove";
    removeButton.addEventListener('click', function() {
        // Remove from expired timers
        let index = expiredTimers.indexOf(currentTimer);
        if (index !== -1) {
            expiredTimers.splice(index, 1);
            modal.innerHTML = ''; // Clear modal
            if (expiredTimers.length > 0) {
                generateModal(expiredTimers); // Re-render remaining expired timers
            } else {
                modal.style.display = "none";
            }
            // Also remove from the main timers list if present and persist
            if (typeof timers !== 'undefined') {
                const mainIndex = timers.findIndex(t => t.timerid === currentTimer.timerid);
                if (mainIndex !== -1) timers.splice(mainIndex, 1);
            }
            if (typeof saveLocal === 'function') saveLocal();
            // Update main UI so removal is immediately visible
            if (typeof renderTimers === 'function') renderTimers();
        }
    });

    const cursorobjects = [
        // resetButton,
        restartButton,
        removeButton
    ]
    
    for (let i = 0; i < cursorobjects.length; i++) {
        const element = cursorobjects[i];
        
        Object.assign(element.style, {
            cursor: "pointer"
        });
    }
    
    buttonDiv.appendChild(timerText);
    buttonDiv.appendChild(restartButton);
    buttonDiv.appendChild(resetButton);
    buttonDiv.appendChild(removeButton);
}