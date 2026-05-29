document.addEventListener("DOMContentLoaded", () => {
    // Path to your JSON file
    fetch('json/credits-update.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            renderCredits(data.credits);
            renderUpdates(data.updates);
        })
        .catch(error => console.error('Error loading operational data:', error));
});

function renderCredits(credits) {
    const tbody = document.getElementById('credits-tbody');
    tbody.innerHTML = credits.map(member => `
        <tr>
            <td><b>${member.role}</b></td>
            <td>${member.name}</td>
            <td>${member.focus}</td>
        </tr>
    `).join('');
}

function renderUpdates(updates) {
    const tbody = document.getElementById('updates-tbody');
    tbody.innerHTML = updates.map(item => `
        <tr>
            <td>${item.date}</td>
            <td><span class="version-tag">${item.version}</span></td>
            <td>${item.description}</td>
            <td>${item.status}</td>
        </tr>
    `).join('');
}
