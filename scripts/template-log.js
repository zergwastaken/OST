document.addEventListener('DOMContentLoaded', () => {
    // Set the current date in the header
    const dateElement = document.getElementById('current-date');
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = today.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = String(today.getFullYear()).slice(-2);
    dateElement.textContent = `${day} ${month} ${year}`;

    let templates = [];
    const tableBody = document.getElementById('log-body');
    const searchBar = document.getElementById('search-bar');

    // Render function
    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {
            // Create Category Separator Row
            const categoryRow = document.createElement('tr');
            categoryRow.className = 'category-row';
            categoryRow.innerHTML = `
                <td colspan="3">
                    ${item.category}
                </td>
            `;
            tableBody.appendChild(categoryRow);

            // Create Data Entry Row
            const row = document.createElement('tr');
            if (item.category === 'T O L E') {
                row.innerHTML = `
                    <td colspan="3" class="tole-row">
                        <span class="entry-text">T.O.L.E. — ${item.entry} — ${item.time}</span>
                        <button class="copy-btn" onclick="copyText(this, \`T.O.L.E. — ${item.entry} — ${item.time}\`)">Copy</button>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td>
                        <button class="copy-btn" onclick="copyText(this, \`${item.entry}\`)">Copy</button>
                        <span class="entry-text">${item.entry}</span>
                    </td>
                    <td>${item.freq}</td>
                    <td>${item.time}</td>
                `;
            }
            tableBody.appendChild(row);
        });
    }

    // Fetch the JSON file
    fetch('json/templates.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            templates = data;
            renderTable(templates); // Initial render
        })
        .catch(error => {
            console.error('Error fetching templates:', error);
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Error loading templates. Ensure you are running a local web server (e.g., Live Server) rather than opening the file directly.</td></tr>';
        });

    // Search logic
    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = templates.filter(item => {
            return item.category.toLowerCase().includes(query) || 
                    item.entry.toLowerCase().includes(query) ||
                    item.freq.toLowerCase().includes(query);
        });
        renderTable(filtered);
    });

    // Global Copy to Clipboard function
    window.copyText = function(button, text) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.innerText;
            button.innerText = 'Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerText = originalText;
                button.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };
});
