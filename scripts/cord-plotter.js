// --- GLOBAL STATE & URL CONFIGURATION ---
const urlParams = new URLSearchParams(window.location.search);
const initialLat = parseFloat(urlParams.get('lat'));
const initialLon = parseFloat(urlParams.get('lon'));
const initialZoom = parseInt(urlParams.get('zoom'));
const initialBase = urlParams.get('base') || 'street';
const initialOverlays = (urlParams.get('overlays') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const hasValidCoords = !isNaN(initialLat) && !isNaN(initialLon);
const hasValidZoom = !isNaN(initialZoom);

let marker = null;
let selectedLatLng = null;
const contextMenu = document.getElementById('waypointContextMenu');

// Set view based on URL coords and zoom, or default fallbacks
const map = L.map('map', { zoomControl: false })
    .setView(
        hasValidCoords ? [initialLat, initialLon] : [39.8, -98.5], 
        hasValidZoom ? initialZoom : (hasValidCoords ? 10 : 4)
    );

// Layer 1: Street (Cached)
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    keepBuffer: 4, 
    updateWhenIdle: false, 
    updateInterval: 150, 
    useCache: true, 
    crossOrigin: true, 
    cacheMaxAge: 1000 * 60 * 60 * 24 * 7 
});

// Layer 2: Satellite Imagery
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Layer 3: Topographic Map
const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
});

// Add the initial base layer selected via URL, or default to standard street
if (initialBase === 'satellite') {
    satelliteLayer.addTo(map);
} else if (initialBase === 'topo') {
    topoLayer.addTo(map);
} else {
    streetLayer.addTo(map);
}

// --- NAUTICAL CHART OVERLAY LAYERS ---
const nauticalLayers = {
    "openseamap": L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
        maxZoom: 18,
        zIndex: 1000 // Ensure overlays render above any active base layers
    }),
    "noaa": L.tileLayer.wms('https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer', {
        layers: '0,1,2,3,4,5,6,7,8,9,10,11,12', // Requesting standard navigational chart layers
        format: 'image/png',
        transparent: true,
        attribution: 'Tiles &copy; NOAA / Office of Coast Survey',
        maxZoom: 18,
        opacity: 0.85,
        zIndex: 999 // Ensure overlays render above any active base layers
    })
};

// Add initial overlays loaded from URL parameters
initialOverlays.forEach(overlayId => {
    if (nauticalLayers[overlayId]) {
        nauticalLayers[overlayId].addTo(map);
    }
});

const baseMaps = {
    "Standard Street": streetLayer,
    "Satellite Imagery": satelliteLayer,
    "Topographic Map": topoLayer
};

const overlayMaps = {
    "OpenSeaMap Overlay": nauticalLayers.openseamap,
    "NOAA Marine Charts": nauticalLayers.noaa
};

L.control.layers(baseMaps, overlayMaps, {position: 'bottomright'}).addTo(map);

map.on('click mousedown dragstart zoomstart', closeContextMenu);
document.addEventListener('click', closeContextMenu);

// --- MAP CLICK HANDLER ---
map.on('click', function(e) {
    if (isMeasuring) return;
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    updateMarker(lat, lon);
    populateInputs(lat, lon);
    calculateResults(lat, lon);
});

// --- URL CENTRAL SYNC FUNCTION ---
// Handles writing all current UI and map states directly into URL parameters
function syncURL() {
    const url = new URL(window.location);

    // Save map coordinate if a marker exists
    if (marker) {
        const pos = marker.getLatLng();
        url.searchParams.set('lat', pos.lat.toFixed(6));
        url.searchParams.set('lon', pos.lng.toFixed(6));
    } else {
        url.searchParams.delete('lat');
        url.searchParams.delete('lon');
    }

    // Save map zoom
    url.searchParams.set('zoom', map.getZoom());

    // Save active base layer
    let activeBase = 'street';
    if (map.hasLayer(satelliteLayer)) activeBase = 'satellite';
    else if (map.hasLayer(topoLayer)) activeBase = 'topo';
    url.searchParams.set('base', activeBase);

    // Save active overlays list
    const activeOverlays = [];
    if (map.hasLayer(nauticalLayers.openseamap)) activeOverlays.push('openseamap');
    if (map.hasLayer(nauticalLayers.noaa)) activeOverlays.push('noaa');

    if (activeOverlays.length > 0) {
        url.searchParams.set('overlays', activeOverlays.join(','));
    } else {
        url.searchParams.delete('overlays');
    }

    window.history.replaceState({}, '', url);
}

// Bind viewport pan, zooms, and layer changes to the central URL sync
map.on('moveend zoomend baselayerchange', syncURL);

function updateMarker(lat, lon, updateUrl = true) {
    if (marker) {
        marker.setLatLng([lat, lon]);
    } else {
        marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        marker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            populateInputs(pos.lat, pos.lng);
            calculateResults(pos.lat, pos.lng);
            syncURL(); // Keep URL coordinates matched to updated drag position
        });
        marker.on('contextmenu', function(e) {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);
            selectedLatLng = e.latlng;
            const menu = document.getElementById('waypointContextMenu');
            if (menu) {
                menu.style.left = e.containerPoint.x + 'px';
                menu.style.top = e.containerPoint.y + 'px';
                menu.style.display = 'block';
            }
        });
    }

    if (updateUrl) {
        syncURL();
    }
}

function closeContextMenu() {
    const menu = document.getElementById('waypointContextMenu');
    if (menu) menu.style.display = 'none';
}

function handleMenuOption(action) {
    closeContextMenu();
    if (!selectedLatLng) return;
    if (action === 'measure') {
        startMeasureFromWaypoint(selectedLatLng);
    } else if (action === 'copy') {
        const tempDiv = document.getElementById('resDDM');
        if (tempDiv && tempDiv.innerText !== '-- --') {
            navigator.clipboard.writeText(tempDiv.innerText);
            alert("Copied: " + tempDiv.innerText);
        }
    } else if (action === 'clear') {
        if (marker) {
            map.removeLayer(marker);
            marker = null;
            clearURLParams(); // Clears coordinate pairs from URL
        }
    }
}

function toggleInputs() {
    const formatSelect = document.getElementById("inputFormat");
    if (!formatSelect) return;
    const format = formatSelect.value;
    const ddm = document.getElementById("ddmInputs");
    const dd = document.getElementById("ddInputs");
    const dms = document.getElementById("dmsInputs");
    if (ddm) ddm.style.display = format === "DDM" ? "block" : "none";
    if (dd) dd.style.display = format === "DD" ? "block" : "none";
    if (dms) dms.style.display = format === "DMS" ? "block" : "none";
}

function manualEntry() {
    const formatSelect = document.getElementById("inputFormat");
    if (!formatSelect) return;
    const format = formatSelect.value;
    let lat = NaN, lon = NaN;

    if (format === "DD") {
        const latInput = document.getElementById("ddLat");
        const lonInput = document.getElementById("ddLon");
        if (latInput && lonInput) {
            lat = parseFloat(latInput.value);
            lon = parseFloat(lonInput.value);
        }
    } else if (format === "DDM") {
        const dDeg = document.getElementById("ddmLatDeg"), dMin = document.getElementById("ddmLatMin"), dDir = document.getElementById("ddmLatDir");
        const nDeg = document.getElementById("ddmLonDeg"), nMin = document.getElementById("ddmLonMin"), nDir = document.getElementById("ddmLonDir");

        if (dDeg && dMin && dDir && nDeg && nMin && nDir) {
            let lD = parseFloat(dDeg.value), lM = parseFloat(dMin.value);
            let lnD = parseFloat(nDeg.value), lnM = parseFloat(nMin.value);
            if(!isNaN(lD)) lat = (lD + (lM||0)/60) * (dDir.value==="S"?-1:1);
            if(!isNaN(lnD)) lon = (lnD + (lnM||0)/60) * (nDir.value==="W"?-1:1);
        }
    } else if (format === "DMS") {
        const dDeg = document.getElementById("dmsLatDeg"), dMin = document.getElementById("dmsLatMin"), dSec = document.getElementById("dmsLatSec"), dDir = document.getElementById("dmsLatDir");
        const nDeg = document.getElementById("dmsLonDeg"), nMin = document.getElementById("dmsLonMin"), nSec = document.getElementById("dmsLonSec"), nDir = document.getElementById("dmsLonDir");

        if (dDeg && dMin && dSec && dDir && nDeg && nMin && nSec && nDir) {
            let lD = parseFloat(dDeg.value), lM = parseFloat(dMin.value), lS = parseFloat(dSec.value);
            let lnD = parseFloat(nDeg.value), lnM = parseFloat(nMin.value), lnS = parseFloat(nSec.value);
            if(!isNaN(lD)) lat = (lD + (lM||0)/60 + (lS||0)/3600) * (dDir.value==="S"?-1:1);
            if(!isNaN(lnD)) lon = (lnD + (lnM||0)/60 + (lnS||0)/3600) * (nDir.value==="W"?-1:1);
        }
    }
    if (!isNaN(lat) && !isNaN(lon)) {
        updateMarker(lat, lon);
        populateInputs(lat, lon, format); // Skip rewriting the active fields being edited!
        calculateResults(lat, lon);
        map.panTo([lat, lon]);
    }
}

function populateInputs(lat, lon, skipFormat = null) {
    const el = (id) => document.getElementById(id);
    
    // Only update decimal fields if we aren't currently editing them
    if (skipFormat !== "DD") {
        const ddLat = el("ddLat"), ddLon = el("ddLon");
        if (ddLat) ddLat.value = lat.toFixed(6);
        if (ddLon) ddLon.value = lon.toFixed(6);
    }

    const absLat = Math.abs(lat), absLon = Math.abs(lon);

    // Only update DDM fields if we aren't currently editing them
    if (skipFormat !== "DDM") {
        const ddmLatDeg = el("ddmLatDeg"), ddmLatMin = el("ddmLatMin"), ddmLatDir = el("ddmLatDir");
        if (ddmLatDeg) ddmLatDeg.value = Math.floor(absLat);
        if (ddmLatMin) ddmLatMin.value = ((absLat % 1) * 60).toFixed(4);
        if (ddmLatDir) ddmLatDir.value = lat >= 0 ? "N" : "S";

        const ddmLonDeg = el("ddmLonDeg"), ddmLonMin = el("ddmLonMin"), ddmLonDir = el("ddmLonDir");
        if (ddmLonDeg) ddmLonDeg.value = Math.floor(absLon);
        if (ddmLonMin) ddmLonMin.value = ((absLon % 1) * 60).toFixed(4);
        if (ddmLonDir) ddmLonDir.value = lon >= 0 ? "E" : "W";
    }

    // Only update DMS fields if we aren't currently editing them
    if (skipFormat !== "DMS") {
        const dmsLatDeg = el("dmsLatDeg"), dmsLatMin = el("dmsLatMin"), dmsLatSec = el("dmsLatSec"), dmsLatDir = el("dmsLatDir");
        if (dmsLatDeg) dmsLatDeg.value = Math.floor(absLat);
        if (dmsLatMin) dmsLatMin.value = Math.floor((absLat % 1) * 60);
        if (dmsLatSec) dmsLatSec.value = ((((absLat % 1) * 60) % 1) * 60).toFixed(1);
        if (dmsLatDir) dmsLatDir.value = lat >= 0 ? "N" : "S";

        const dmsLonDeg = el("dmsLonDeg"), dmsLonMin = el("dmsLonMin"), dmsLonSec = el("dmsLonSec"), dmsLonDir = el("dmsLonDir");
        if (dmsLonDeg) dmsLonDeg.value = Math.floor(absLon);
        if (dmsLonMin) dmsLonMin.value = Math.floor((absLon % 1) * 60);
        if (dmsLonSec) dmsLonSec.value = ((((absLon % 1) * 60) % 1) * 60).toFixed(1);
        if (dmsLonDir) dmsLonDir.value = lon >= 0 ? "E" : "W";
    }
}

function calculateResults(lat, lon) {
    const el = (id) => document.getElementById(id);
    const resDD = el("resDD");
    if (resDD) resDD.innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    const pad = (n, l) => String(Math.floor(n)).padStart(l, '0');

    const ddmLat = `${pad(Math.abs(lat), 2)}° ${((Math.abs(lat)%1)*60).toFixed(4).padStart(7,'0')}' ${lat>=0?'N':'S'}`;
    const ddmLon = `${pad(Math.abs(lon), 3)}° ${((Math.abs(lon)%1)*60).toFixed(4).padStart(7,'0')}' ${lon>=0?'E':'W'}`;
    const resDDM = el("resDDM");
    if (resDDM) resDDM.innerText = `${ddmLat} / ${ddmLon}`;

    const dmsLat = `${pad(Math.abs(lat), 2)}° ${Math.floor((Math.abs(lat)%1)*60)}' ${((((Math.abs(lat)%1)*60)%1)*60).toFixed(1)}" ${lat>=0?'N':'S'}`;
    const dmsLon = `${pad(Math.abs(lon), 3)}° ${Math.floor((Math.abs(lon)%1)*60)}' ${((((Math.abs(lon)%1)*60)%1)*60).toFixed(1)}" ${lon>=0?'E':'W'}`;
    const resDMS = el("resDMS");
    if (resDMS) resDMS.innerText = `${dmsLat} / ${dmsLon}`;
}

function copyResult(id, btn) {
    navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => {
        const old = btn.innerText; btn.innerText = "✓";
        setTimeout(() => btn.innerText = old, 1000);
    });
}

// ==========================================
//   📐 NAUTICAL MILES MEASURE TOOL LOGIC
// ==========================================
let isMeasuring = false;
let measurePoints = [];
let measureLine = null;
let tempLine = null;
let measureMarkers = [];
let tooltip = null;
let segmentLabels = [];

function getDistanceNM(lat1, lon1, lat2, lon2) {
    const R = 3440.065; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const MeasureControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function (map) {
        const container = L.DomUtil.create('a', 'leaflet-bar leaflet-control custom-map-btn');
        container.innerHTML = '📐';
        container.title = "Measure Distance (Nautical Miles)";
        container.id = 'measureControlBtn';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(container, 'click', function (e) {
            toggleMeasure();
        });
        return container;
    }
});

map.addControl(new MeasureControl());

function toggleMeasure() {
    isMeasuring = !isMeasuring;
    const button = document.getElementById('measureControlBtn');

    if (isMeasuring) {
        button.classList.add('active');
        map.getContainer().style.cursor = 'crosshair';
        initMeasure();
    } else {
        button.classList.remove('active');
        map.getContainer().style.cursor = '';
        clearMeasure();
    }
}

function startMeasureFromWaypoint(latlng) {
    if (isMeasuring) clearMeasure(); 
    isMeasuring = true;
    document.getElementById('measureControlBtn').classList.add('active');
    map.getContainer().style.cursor = 'crosshair';

    initMeasure();

    measurePoints.push(latlng);
    measureLine.addLatLng(latlng);
    const m = L.circleMarker(latlng, { radius: 5, color: '#ff3366', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
    measureMarkers.push(m);
    tooltip = L.tooltip({ permanent: true, direction: 'top', className: 'measure-tooltip' })
        .setLatLng(latlng).setContent('0.00 NM <span class="hint">Right-click to finish</span>').addTo(map);
}

// --- MEASUREMENT LOGIC DRAWINGS ---
function initMeasure() {
    measurePoints = [];
    measureMarkers = [];
    segmentLabels = [];
    measureLine = L.polyline([], { color: '#ff3366', weight: 4, opacity: 0.8 }).addTo(map);
    tempLine = L.polyline([], { color: '#ff3366', weight: 3, opacity: 0.5, dashArray: '5, 10' }).addTo(map);
    map.on('click', onMeasureClick);
    map.on('mousemove', onMeasureMouseMove);
    map.on('contextmenu', finishMeasure);
}

function onMeasureClick(e) {
    const latlng = e.latlng;

    if (measurePoints.length > 0) {
        const prevPoint = measurePoints[measurePoints.length - 1];
        const segDist = getDistanceNM(prevPoint.lat, prevPoint.lng, latlng.lat, latlng.lng);
        const midPoint = L.latLngBounds([prevPoint, latlng]).getCenter();

        const segLabel = L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'segment-tooltip'
        }).setLatLng(midPoint).setContent(segDist.toFixed(2) + ' NM').addTo(map);

        segmentLabels.push(segLabel);
    }
    measurePoints.push(latlng);
    measureLine.addLatLng(latlng);
    const m = L.circleMarker(latlng, { radius: 5, color: '#ff3366', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
    measureMarkers.push(m);
    if (measurePoints.length === 1) {
        tooltip = L.tooltip({ permanent: true, direction: 'top', className: 'measure-tooltip' })
            .setLatLng(latlng).setContent('0.00 NM <span class="hint">Right-click to finish</span>').addTo(map);
    } else {
        updateTooltip(latlng);
    }
}

function onMeasureMouseMove(e) {
    if (measurePoints.length > 0) {
        const lastPoint = measurePoints[measurePoints.length - 1];
        tempLine.setLatLngs([lastPoint, e.latlng]);
        updateTooltip(e.latlng);
    }
}

function updateTooltip(currentLatLng) {
    if (!tooltip) return;
    let totalDist = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
        totalDist += getDistanceNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i+1].lat, measurePoints[i+1].lng);
    }
    if (measurePoints.length > 0) {
        const last = measurePoints[measurePoints.length - 1];
        totalDist += getDistanceNM(last.lat, last.lng, currentLatLng.lat, currentLatLng.lng);
    }
    tooltip.setLatLng(currentLatLng).setContent('Total: ' + totalDist.toFixed(2) + ' NM <span class="hint">Right-click to finish</span>');
}

function finishMeasure(e) {
    if (e) L.DomEvent.preventDefault(e);
    tempLine.setLatLngs([]);
    if (measurePoints.length > 1) {
        let totalDist = 0;
        for (let i = 0; i < measurePoints.length - 1; i++) {
            totalDist += getDistanceNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i+1].lat, measurePoints[i+1].lng);
        }
        if (tooltip) {
            tooltip.setLatLng(measurePoints[measurePoints.length - 1]).setContent('Total Track: ' + totalDist.toFixed(2) + ' NM');
        }
    }
    toggleMeasure();
}

function clearMeasure() {
    map.off('click', onMeasureClick);
    map.off('mousemove', onMeasureMouseMove);
    map.off('contextmenu', finishMeasure);
    if (measureLine) map.removeLayer(measureLine);
    if (tempLine) map.removeLayer(tempLine);
    if (tooltip) map.removeLayer(tooltip);

    measureMarkers.forEach(m => map.removeLayer(m));
    segmentLabels.forEach(lbl => map.removeLayer(lbl));

    measurePoints = [];
    measureMarkers = [];
    segmentLabels = [];
    measureLine = null;
    tempLine = null;
    tooltip = null;
}

// --- URL PARAMS HANDLERS ---

// Clears coordinates from URL parameters, but retains zoom, basemap, and overlays
function clearURLParams() {
    const url = new URL(window.location);
    url.searchParams.delete('lat');
    url.searchParams.delete('lon');
    window.history.replaceState({}, '', url);
    syncURL();
}

// --- NAUTICAL OVERLAYS SYNC HANDLERS ---

function toggleOverlayCheckbox(overlayId, isChecked) {
    if (nauticalLayers[overlayId]) {
        if (isChecked) {
            nauticalLayers[overlayId].addTo(map);
        } else {
            map.removeLayer(nauticalLayers[overlayId]);
        }
    }
    syncURL();
}

// Sync the sidebar checkboxes with manual Leaflet Layer Control switches
map.on('layeradd', function(e) {
    if (e.layer === nauticalLayers.openseamap) {
        const chk = document.getElementById("chkOpenSeaMap");
        if (chk) chk.checked = true;
        syncURL();
    } else if (e.layer === nauticalLayers.noaa) {
        const chk = document.getElementById("chkNOAA");
        if (chk) chk.checked = true;
        syncURL();
    }
});

map.on('layerremove', function(e) {
    if (e.layer === nauticalLayers.openseamap) {
        const chk = document.getElementById("chkOpenSeaMap");
        if (chk) chk.checked = false;
        syncURL();
    } else if (e.layer === nauticalLayers.noaa) {
        const chk = document.getElementById("chkNOAA");
        if (chk) chk.checked = false;
        syncURL();
    }
});

// --- INITIALIZATION ON PAGE LOAD (DOM-SAFE) ---
function initializeApp() {
    // Sync the sidebar checkboxes with the initial overlays parsed from URL
    const chkOpenSeaMap = document.getElementById("chkOpenSeaMap");
    if (chkOpenSeaMap) {
        chkOpenSeaMap.checked = initialOverlays.includes("openseamap");
    }
    const chkNOAA = document.getElementById("chkNOAA");
    if (chkNOAA) {
        chkNOAA.checked = initialOverlays.includes("noaa");
    }

    // Initialize marker and inputs if valid coords are present
    if (hasValidCoords) {
        updateMarker(initialLat, initialLon, false); 
        populateInputs(initialLat, initialLon);
        calculateResults(initialLat, initialLon);
    }
}

// Safely execute initial values even if page loaded faster than event assignment
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeApp();
} else {
    window.addEventListener('DOMContentLoaded', initializeApp);
}
