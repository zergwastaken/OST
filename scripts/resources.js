// 1. Declare the global variable
let acronyms = []; 

// 2. Fetch data, then build the table
async function loadAcronyms() {
    try {
        const response = await fetch('json/acronyms.json'); 
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Save the data to the GLOBAL variable (no 'const' or 'let' here)
        acronyms = await response.json(); 
        
        console.log("Acronyms loaded successfully:", acronyms);
        
        // Build the table ONLY after the data is successfully loaded
        buildTable();

    } catch (error) {
        console.error("Error loading the acronyms JSON file:", error);
    }
}

// 3. Function dedicated to building the table rows
function buildTable() {
    const tableElement = document.getElementById('slangTable');
    if (!tableElement) {
        console.error("Table element '#slangTable' not found in HTML!");
        return;
    }

    // Clear any "Loading..." text or old content
    tableElement.innerHTML = ""; 

    // Loop through the loaded data and build the rows
    for (let i = 0; i < acronyms.length; i++) {
        const element = acronyms[i];
        
        // Create the row
        const tableRow = document.createElement("tr");
        tableRow.classList.add("slang-row");
        tableElement.appendChild(tableRow);
    
        // Create the Acronym cell (Column 0)
        const tableData = document.createElement("td");
        tableData.classList.add("term");
        tableData.textContent = element[0];
        tableRow.appendChild(tableData);
        
        // Create the Definition cell (Column 1)
        const tableData2 = document.createElement("td");
        tableData2.textContent = element[1];
        tableRow.appendChild(tableData2);
    }
}

// 4. Trigger the process when the page finishes loading
document.addEventListener('DOMContentLoaded', function() {
    loadAcronyms();
});

// Slang Search Filter
function filterSlang() {
    const query = document.getElementById("slangSearch").value.toLowerCase();
    const rows = document.querySelectorAll(".slang-row");

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(query)) {
            row.classList.remove("hidden-row");
        } else {
            row.classList.add("hidden-row");
        }
    });
}

// Copy Template Function
function copyTemplate(elementId, btn) {
    const textArea = document.getElementById(elementId);
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(textArea.value).then(() => {
        const originalText = btn.innerText;
        btn.innerText = "Copied!";
        btn.style.color = "var(--highlight-yellow)";
        btn.style.borderColor = "var(--highlight-yellow)";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.color = "var(--text-main)";
            btn.style.borderColor = "var(--border-ui)";
        }, 2000);
    });
}
