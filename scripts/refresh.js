let wakeLock = null;

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('Wake Lock is active! Tab will not freeze.');
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
  }
}

// Request the lock when the timer starts
requestWakeLock();

// Create an inaudible audio context loop
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const oscillator = audioCtx.createOscillator();
const gainNode = audioCtx.createGain();

oscillator.connect(gainNode);
gainNode.connect(audioCtx.destination);

// Set volume to almost zero so it's silent to human ears
gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime); 

oscillator.start();
