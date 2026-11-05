// Database Fetch Engine
        async function loadAndRenderRanks() {
            const container = document.getElementById('ranks-container');
            
            try {
                const response = await fetch('json/mil-ranks.json');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const militaryData = await response.json();
                renderTables(militaryData);
                
            } catch (error) {
                console.error('Error fetching the ranks database:', error);
                container.innerHTML = `<div style="color: red; text-align: center; padding: 20px;"><h3>⚠️ Error Loading Ranks Database</h3><p>Ensure you are running a local web server to bypass CORS restrictions.</p></div>`;
            }
        }

        // Table Generation Engine
        function renderTables(data) {
    const container = document.getElementById('ranks-container');
    container.innerHTML = ''; 

    // Mapping official branch emblems
    const branchLogos = {
        "United States Coast Guard": "images/mil-ranks/coast-guard/sealCoastGuard.png",
        "United States Army": "images/mil-ranks/army/sealArmy.png",
        "United States Marine Corps": "images/mil-ranks/marines/sealMarineCorps.png",
        "United States Navy": "images/mil-ranks/navy/sealNavy.png",
        "United States Air Force": "images/mil-ranks/air-force/sealAirForce.png",
        "United States Space Force": "images/mil-ranks/space-force/sealSpaceForce.png"
    };

    const categoriesConfig = [
        { 
            type: "Enlisted", 
            label: "Enlisted Insignia", 
            // Added "E-9 Special" to the end
            paygrades: ["E-1", "E-2", "E-3", "E-4", "E-5", "E-6", "E-7", "E-8", "E-9", "E-9 Special"] 
        },
        { 
            type: "Warrant Officers", 
            label: "Warrant Officer Insignia", 
            paygrades: ["W-1", "W-2", "W-3", "W-4", "W-5"] 
        },
        { 
            type: "Officers", 
            label: "Officer Insignia", 
            // Added "O-11 (Wartime)" to the end
            paygrades: ["O-1", "O-2", "O-3", "O-4", "O-5", "O-6", "O-7", "O-8", "O-9", "O-10", "O-11 (Wartime)"] 
        }
    ];


    const branches = [
        "United States Coast Guard",
        "United States Army",
        "United States Marine Corps",
        "United States Navy",
        "United States Air Force",
        "United States Space Force"
    ];

    categoriesConfig.forEach(config => {
        const section = document.createElement('div');
        section.className = 'table-section';
        
        const title = document.createElement('h2');
        title.className = 'section-title';
        title.textContent = config.label;
        section.appendChild(title);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        const table = document.createElement('table');
        
        // Build the Header Row (<thead>) with Logos
        const thead = document.createElement('thead');
        let headerRow = '<tr><th>Paygrade</th>';
        
        branches.forEach(branch => {
            const shortName = branch.replace('United States ', '');
            const logoUrl = branchLogos[branch] || "";
            
            headerRow += `
                <th>
                    <div class="header-content">
                        <img src="${logoUrl}" alt="${shortName} Emblem" class="branch-header-logo">
                        <span>${shortName}</span>
                    </div>
                </th>`;
        });
        
        headerRow += '</tr>';
        thead.innerHTML = headerRow;
        table.appendChild(thead);

        // Build the Body Rows (<tbody>)
        const tbody = document.createElement('tbody');
        tbody.classList.add('ranks-tbody');
        config.paygrades.forEach(pg => {
            const tr = document.createElement('tr');
            
            const tdPg = document.createElement('td');
            tdPg.className = 'paygrade-cell';
            tdPg.textContent = pg;
            tr.appendChild(tdPg);

            branches.forEach(branchName => {
                const td = document.createElement('td');
                const branchData = data.find(b => b.branch === branchName);
                
                if (branchData) {
                    const catData = branchData.categories.find(c => c.type === config.type);
                    if (catData) {
                        const ranksAtPaygrade = catData.ranks.filter(r => r.paygrade === pg);
                        
                        if (ranksAtPaygrade.length > 0) {
                            td.innerHTML = ranksAtPaygrade.map(r => {
                                // Check if image is blank, null, or set to "none"
                                const hasInsignia = r.img && r.img !== "" && r.img !== "none";
                                const insigniaHtml = hasInsignia 
                                    ? `<img src="${r.img}" alt="${r.name} Insignia">` 
                                    : `<div class="no-insignia-badge">No Insignia</div>`;

                                return `
                                    <div class="rank-entry">
                                        ${insigniaHtml}
                                        <div class="rank-name">${r.name}</div>
                                        <div class="rank-abbr">${r.abbr}</div>
                                    </div>
                                `;
                            }).join('<div class="rank-divider"></div>');
                        } else {
                            td.innerHTML = '<div class="no-rank">NO RANK</div>';
                        }
                    } else {
                        td.innerHTML = '<div class="no-rank">NO RANK</div>';
                    }
                } else {
                     td.innerHTML = '<div class="no-rank">NO RANK</div>';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        section.appendChild(tableWrapper);
        container.appendChild(section);
    });
}

        // Execute on load
        window.onload = loadAndRenderRanks;
