// --- MAP INITIALIZATION & LAYERS ---
const map = L.map('map', { zoomControl: false }).setView([39.8, -98.5], 4);

// Layer 1: Street (Cached)
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    keepBuffer: 4, updateWhenIdle: false, updateInterval: 150, useCache: true, crossOrigin: true, cacheMaxAge: 1000*60*60*24*7 
});
// Layer 2: Satellite Imagery
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});
// Layer 3: Topographic Map
const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
});

streetLayer.addTo(map);

const baseMaps = {
    "Standard Street": streetLayer,
    "Satellite Imagery": satelliteLayer,
    "Topographic Map": topoLayer
};
L.control.layers(baseMaps, null, {position: 'bottomright'}).addTo(map);
// L.control.zoom({ position: 'bottomright' }).addTo(map);

let marker = null;
let selectedLatLng = null;

const contextMenu = document.getElementById('waypointContextMenu');
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

function updateMarker(lat, lon) {
    if (marker) {
        marker.setLatLng([lat, lon]);
    } else {
        marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        
        marker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            populateInputs(pos.lat, pos.lng);
            calculateResults(pos.lat, pos.lng);
        });

        marker.on('contextmenu', function(e) {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);
            selectedLatLng = e.latlng;
            contextMenu.style.left = e.containerPoint.x + 'px';
            contextMenu.style.top = e.containerPoint.y + 'px';
            contextMenu.style.display = 'block';
        });
    }
}

function closeContextMenu() {
    contextMenu.style.display = 'none';
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
        }
    }
}

function toggleInputs() {
    const format = document.getElementById("inputFormat").value;
    document.getElementById("ddmInputs").style.display = format === "DDM" ? "block" : "none";
    document.getElementById("ddInputs").style.display = format === "DD" ? "block" : "none";
    document.getElementById("dmsInputs").style.display = format === "DMS" ? "block" : "none";
}

function manualEntry() {
    const format = document.getElementById("inputFormat").value;
    let lat = NaN, lon = NaN;
    if (format === "DD") {
        lat = parseFloat(document.getElementById("ddLat").value);
        lon = parseFloat(document.getElementById("ddLon").value);
    } else if (format === "DDM") {
        let lD = parseFloat(document.getElementById("ddmLatDeg").value), lM = parseFloat(document.getElementById("ddmLatMin").value);
        let lnD = parseFloat(document.getElementById("ddmLonDeg").value), lnM = parseFloat(document.getElementById("ddmLonMin").value);
        if(!isNaN(lD)) lat = (lD + (lM||0)/60) * (document.getElementById("ddmLatDir").value==="S"?-1:1);
        if(!isNaN(lnD)) lon = (lnD + (lnM||0)/60) * (document.getElementById("ddmLonDir").value==="W"?-1:1);
    } else if (format === "DMS") {
        let lD = parseFloat(document.getElementById("dmsLatDeg").value), lM = parseFloat(document.getElementById("dmsLatMin").value), lS = parseFloat(document.getElementById("dmsLatSec").value);
        let lnD = parseFloat(document.getElementById("dmsLonDeg").value), lnM = parseFloat(document.getElementById("dmsLonMin").value), lnS = parseFloat(document.getElementById("dmsLonSec").value);
        if(!isNaN(lD)) lat = (lD + (lM||0)/60 + (lS||0)/3600) * (document.getElementById("dmsLatDir").value==="S"?-1:1);
        if(!isNaN(lnD)) lon = (lnD + (lnM||0)/60 + (lnS||0)/3600) * (document.getElementById("dmsLonDir").value==="W"?-1:1);
    }
    if (!isNaN(lat) && !isNaN(lon)) {
        updateMarker(lat, lon);
        calculateResults(lat, lon);
        map.panTo([lat, lon]);
    }
}

function populateInputs(lat, lon) {
    document.getElementById("ddLat").value = lat.toFixed(6);
    document.getElementById("ddLon").value = lon.toFixed(6);
    
    const absLat = Math.abs(lat), absLon = Math.abs(lon);
    document.getElementById("ddmLatDeg").value = Math.floor(absLat);
    document.getElementById("ddmLatMin").value = ((absLat % 1) * 60).toFixed(4);
    document.getElementById("ddmLatDir").value = lat >= 0 ? "N" : "S";
    document.getElementById("ddmLonDeg").value = Math.floor(absLon);
    document.getElementById("ddmLonMin").value = ((absLon % 1) * 60).toFixed(4);
    document.getElementById("ddmLonDir").value = lon >= 0 ? "E" : "W";

    document.getElementById("dmsLatDeg").value = Math.floor(absLat);
    document.getElementById("dmsLatMin").value = Math.floor((absLat % 1) * 60);
    document.getElementById("dmsLatSec").value = ((((absLat % 1) * 60) % 1) * 60).toFixed(1);
    document.getElementById("dmsLatDir").value = lat >= 0 ? "N" : "S";
    document.getElementById("dmsLonDeg").value = Math.floor(absLon);
    document.getElementById("dmsLonMin").value = Math.floor((absLon % 1) * 60);
    document.getElementById("dmsLonSec").value = ((((absLon % 1) * 60) % 1) * 60).toFixed(1);
    document.getElementById("dmsLonDir").value = lon >= 0 ? "E" : "W";
}

function calculateResults(lat, lon) {
    document.getElementById("resDD").innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    const pad = (n, l) => String(Math.floor(n)).padStart(l, '0');
    
    const ddmLat = `${pad(Math.abs(lat), 2)}° ${((Math.abs(lat)%1)*60).toFixed(4).padStart(7,'0')}' ${lat>=0?'N':'S'}`;
    const ddmLon = `${pad(Math.abs(lon), 3)}° ${((Math.abs(lon)%1)*60).toFixed(4).padStart(7,'0')}' ${lon>=0?'E':'W'}`;
    document.getElementById("resDDM").innerText = `${ddmLat} / ${ddmLon}`;
    
    const dmsLat = `${pad(Math.abs(lat), 2)}° ${Math.floor((Math.abs(lat)%1)*60)}' ${((((Math.abs(lat)%1)*60)%1)*60).toFixed(1)}" ${lat>=0?'N':'S'}`;
    const dmsLon = `${pad(Math.abs(lon), 3)}° ${Math.floor((Math.abs(lon)%1)*60)}' ${((((Math.abs(lon)%1)*60)%1)*60).toFixed(1)}" ${lon>=0?'E':'W'}`;
    document.getElementById("resDMS").innerText = `${dmsLat} / ${dmsLon}`;
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
        // Calculate segment distance and place label in the middle
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
        totalDist += getDistanceNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i + 1].lat, measurePoints[i + 1].lng);
    }
    if (measurePoints.length > 0) {
        const last = measurePoints[measurePoints.length - 1];
        totalDist += getDistanceNM(last.lat, last.lng, currentLatLng.lat, currentLatLng.lng);
    }
    tooltip.setLatLng(currentLatLng).setContent('Total: ' + totalDist.toFixed(2) + ' NM <span class="hint">Right-click to finish</span>');
}

function finishMeasure(e) {
    if (e) L.DomEvent.preventDefault(e); // Prevent browser context menu

    tempLine.setLatLngs([]);
    if (measurePoints.length > 1) {
        let totalDist = 0;
        for (let i = 0; i < measurePoints.length - 1; i++) {
            totalDist += getDistanceNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i + 1].lat, measurePoints[i + 1].lng);
        }
        if (tooltip) {
            tooltip.setLatLng(measurePoints[measurePoints.length - 1]).setContent('Total Track: ' + totalDist.toFixed(2) + ' NM');
        }
    }
    toggleMeasure(); // Turns off the drawing state but leaves lines/labels on map
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
