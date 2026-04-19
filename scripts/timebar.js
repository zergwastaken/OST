function updateTimeBar() {
    const current = new Date();
    const local = current.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
    const zulu = current.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC'});
    document.getElementById('localTime').textContent = local;
    document.getElementById('zuluTime').textContent = zulu;
}
updateTimeBar();
setInterval(updateTimeBar, 1000);