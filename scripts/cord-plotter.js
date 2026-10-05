// --- GLOBAL STATE & URL CONFIGURATION ---
const urlParams = new URLSearchParams(window.location.search);
const initialLat = parseFloat(urlParams.get('lat'));
const initialLon = parseFloat(urlParams.get('lon'));
const initialZoom = parseInt(urlParams.get('zoom'));
const initialViewLat = parseFloat(urlParams.get('viewLat'));
const initialViewLon = parseFloat(urlParams.get('viewLon'));
const initialViewZoom = parseInt(urlParams.get('viewZoom'));
const savedMapViewKey = 'cordPlotterMapView';
const nauticalMileToMiles = 1.150779448;
let savedMapView = null;

try {
    savedMapView = JSON.parse(localStorage.getItem(savedMapViewKey) || 'null');
} catch (error) {
    console.warn('Could not read the saved plotter map view.', error);
}

const initialBase = urlParams.get('base') || savedMapView?.base || 'street';
const initialOverlays = urlParams.has('overlays')
    ? urlParams.get('overlays').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : (Array.isArray(savedMapView?.overlays) ? savedMapView.overlays : []);

const hasUrlCoords = Number.isFinite(initialLat) && Number.isFinite(initialLon) &&
    Math.abs(initialLat) <= 90 && Math.abs(initialLon) <= 180;
const hasUrlView = Number.isFinite(initialViewLat) && Number.isFinite(initialViewLon) &&
    Number.isFinite(initialViewZoom) && Math.abs(initialViewLat) <= 90 &&
    Math.abs(initialViewLon) <= 180 && initialViewZoom >= 0 && initialViewZoom <= 22;
const hasSavedView = savedMapView && Number.isFinite(savedMapView.lat) &&
    Number.isFinite(savedMapView.lon) && Number.isFinite(savedMapView.zoom) &&
    Math.abs(savedMapView.lat) <= 90 && Math.abs(savedMapView.lon) <= 180 &&
    savedMapView.zoom >= 0 && savedMapView.zoom <= 22;
const startLat = hasUrlView ? initialViewLat : (hasSavedView ? savedMapView.lat : (hasUrlCoords ? initialLat : 39.8));
const startLon = hasUrlView ? initialViewLon : (hasSavedView ? savedMapView.lon : (hasUrlCoords ? initialLon : -98.5));
const startZoom = hasUrlView ? initialViewZoom : (hasSavedView ? savedMapView.zoom : (Number.isFinite(initialZoom) ? initialZoom : (hasUrlCoords ? 10 : 4)));

let marker = null;
let selectedLatLng = null;
const contextMenu = document.getElementById('waypointContextMenu');
let boundaryDrawing = false;
let boundaryDrawingPoints = [];

// Keep the coordinate controls compact over the map on mobile devices.
const plotterPanelToggle = document.getElementById('togglePlotterPanel');
const plotterPanelContent = document.getElementById('plotterPanelContent');
const mobilePlotterQuery = window.matchMedia('(max-width: 700px)');

function refreshPlotterPanelToggleLabel() {
    if (!plotterPanelToggle) return;
    const isExpanded = plotterPanelToggle.getAttribute('aria-expanded') === 'true';
    plotterPanelToggle.textContent = !isExpanded && boundaryDrawing
        ? `Drawing ${boundaryDrawingPoints.length} pts · Show controls`
        : (isExpanded ? 'Hide controls' : 'Show controls');
}

function setPlotterPanelExpanded(expanded) {
    if (!plotterPanelToggle || !plotterPanelContent) return;
    plotterPanelToggle.setAttribute('aria-expanded', String(expanded));
    plotterPanelContent.hidden = !expanded;
    document.querySelector('.converter-container').classList.toggle('is-collapsed', !expanded);
    refreshPlotterPanelToggleLabel();
}

if (plotterPanelToggle && plotterPanelContent) {
    plotterPanelToggle.addEventListener('click', () => {
        const expanded = plotterPanelToggle.getAttribute('aria-expanded') !== 'true';
        setPlotterPanelExpanded(expanded);
    });

    // Start minimized on phones so the map remains the main focus.
    setPlotterPanelExpanded(!mobilePlotterQuery.matches);
    const syncPanelToViewport = event => setPlotterPanelExpanded(!event.matches);
    if (mobilePlotterQuery.addEventListener) mobilePlotterQuery.addEventListener('change', syncPanelToViewport);
    else mobilePlotterQuery.addListener(syncPanelToViewport);
}

const mapToolTabs = Array.from(document.querySelectorAll('.tool-tabs [role="tab"]'));
function activateMapToolTab(tab, moveFocus = false) {
    mapToolTabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(item.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tab.focus();
}

mapToolTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateMapToolTab(tab));
    tab.addEventListener('keydown', event => {
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % mapToolTabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + mapToolTabs.length) % mapToolTabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = mapToolTabs.length - 1;
        else return;
        event.preventDefault();
        activateMapToolTab(mapToolTabs[nextIndex], true);
    });
});

// Set view based on URL coords and zoom, or default fallbacks
const map = L.map('map', { zoomControl: false })
    .setView(
        [startLat, startLon],
        startZoom
    );

let plottedBoundaryLayer = null;
let plottedBoundaryCoordinates = [];
let boundaryNeedsReplot = false;
let boundaryDrawingLayer = null;
let boundaryDrawingLine = null;
let boundaryDrawingMarkers = [];

function updatePinActionButtons() {
    const hasPin = Boolean(marker);
    ['copyPinBtn', 'measureFromPinBtn', 'clearPinBtn'].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.disabled = !hasPin;
    });
}

function updateBoundaryPointCount() {
    const input = document.getElementById('boundaryCoordinates');
    const count = document.getElementById('boundaryPointCount');
    if (!input || !count) return;
    const lines = input.value.split(/\r?\n/).filter(line => line.trim());
    count.textContent = `${lines.length} coordinate ${lines.length === 1 ? 'line' : 'lines'}`;
}

function getBoundaryMetrics(points) {
    const perimeterNM = points.reduce((total, point, index) => {
        const nextPoint = points[(index + 1) % points.length];
        return total + getDistanceNM(point.lat, point.lon, nextPoint.lat, nextPoint.lon);
    }, 0);

    const earthRadiusNM = 3440.065;
    const areaTerm = points.reduce((total, point, index) => {
        const nextPoint = points[(index + 1) % points.length];
        let deltaLon = degreesToRadians(nextPoint.lon - point.lon);
        if (deltaLon > Math.PI) deltaLon -= 2 * Math.PI;
        if (deltaLon < -Math.PI) deltaLon += 2 * Math.PI;
        return total + deltaLon * (2 + Math.sin(degreesToRadians(point.lat)) + Math.sin(degreesToRadians(nextPoint.lat)));
    }, 0);
    const areaSqNM = Math.abs(areaTerm * earthRadiusNM * earthRadiusNM / 2);

    return { perimeterNM, areaSqNM };
}

function updateBoundaryDrawingControls() {
    const startButton = document.getElementById('startBoundaryDrawingBtn');
    const undoButton = document.getElementById('undoBoundaryPointBtn');
    const finishButton = document.getElementById('finishBoundaryDrawingBtn');
    if (startButton) {
        startButton.textContent = boundaryDrawing ? 'Cancel drawing' : 'Draw boundary on map';
        startButton.setAttribute('aria-pressed', String(boundaryDrawing));
    }
    if (undoButton) undoButton.disabled = !boundaryDrawing || boundaryDrawingPoints.length === 0;
    if (finishButton) finishButton.disabled = !boundaryDrawing || boundaryDrawingPoints.length < 3;
    refreshPlotterPanelToggleLabel();
}

function clearBoundaryDrawingPreview() {
    if (boundaryDrawingLayer) map.removeLayer(boundaryDrawingLayer);
    boundaryDrawingLayer = null;
    boundaryDrawingLine = null;
    boundaryDrawingMarkers = [];
}

function stopBoundaryDrawing(message) {
    boundaryDrawing = false;
    boundaryDrawingPoints = [];
    clearBoundaryDrawingPreview();
    map.getContainer().classList.remove('boundary-drawing-mode');
    updateBoundaryDrawingControls();
    if (message) document.getElementById('boundaryDrawStatus').textContent = message;
}

function startBoundaryDrawing() {
    if (isMeasuring) {
        document.getElementById('boundaryDrawStatus').textContent = 'Stop the distance measurement tool before drawing a boundary.';
        return;
    }
    boundaryDrawing = true;
    boundaryDrawingPoints = [];
    clearBoundaryDrawingPreview();
    boundaryDrawingLayer = L.layerGroup().addTo(map);
    boundaryDrawingLine = L.polyline([], {
        color: '#ff2d2d',
        weight: 3,
        opacity: 0.9,
        dashArray: '7, 6',
        interactive: false
    }).addTo(boundaryDrawingLayer);
    map.getContainer().classList.add('boundary-drawing-mode');
    document.getElementById('boundaryDrawStatus').textContent = 'Drawing mode: click the map to add boundary points. Add at least three, then finish.';
    if (mobilePlotterQuery.matches) setPlotterPanelExpanded(false);
    updateBoundaryDrawingControls();
}

function addBoundaryDrawingPoint(latlng) {
    const point = { lat: latlng.lat, lon: latlng.lng };
    boundaryDrawingPoints.push(point);
    boundaryDrawingLine.setLatLngs(boundaryDrawingPoints.map(item => [item.lat, item.lon]));
    const pointMarker = L.circleMarker(latlng, {
        radius: 6,
        color: '#b00000',
        weight: 2,
        fillColor: '#ff4d4d',
        fillOpacity: 1,
        interactive: false
    }).addTo(boundaryDrawingLayer);
    boundaryDrawingMarkers.push(pointMarker);
    document.getElementById('boundaryDrawStatus').textContent = `Added point ${boundaryDrawingPoints.length}. Click to add another point, or finish when there are at least three.`;
    updateBoundaryDrawingControls();
}

function undoBoundaryDrawingPoint() {
    if (!boundaryDrawingPoints.length) return;
    boundaryDrawingPoints.pop();
    const lastMarker = boundaryDrawingMarkers.pop();
    if (lastMarker) boundaryDrawingLayer.removeLayer(lastMarker);
    boundaryDrawingLine.setLatLngs(boundaryDrawingPoints.map(point => [point.lat, point.lon]));
    document.getElementById('boundaryDrawStatus').textContent = `${boundaryDrawingPoints.length} point${boundaryDrawingPoints.length === 1 ? '' : 's'} remain. Continue clicking the map or finish with at least three.`;
    updateBoundaryDrawingControls();
}

function finishBoundaryDrawing() {
    if (boundaryDrawingPoints.length < 3) {
        document.getElementById('boundaryDrawStatus').textContent = 'Add at least three points before finishing the boundary.';
        return;
    }
    const coordinates = boundaryDrawingPoints.map(point => formatBoundaryCoordinate(point, 'DDM')).join('\n');
    stopBoundaryDrawing('Boundary captured from map clicks. Review the coordinates or copy them in your preferred format.');
    const input = document.getElementById('boundaryCoordinates');
    input.value = coordinates;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    plotCoordinateBoundary();
}

document.getElementById('startBoundaryDrawingBtn').addEventListener('click', () => {
    if (boundaryDrawing) {
        stopBoundaryDrawing('Boundary drawing canceled.');
    } else {
        startBoundaryDrawing();
    }
});
document.getElementById('undoBoundaryPointBtn').addEventListener('click', undoBoundaryDrawingPoint);
document.getElementById('finishBoundaryDrawingBtn').addEventListener('click', finishBoundaryDrawing);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && boundaryDrawing) stopBoundaryDrawing('Boundary drawing canceled.');
});
updateBoundaryDrawingControls();

async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = text;
    temporaryInput.setAttribute('readonly', '');
    temporaryInput.style.position = 'fixed';
    temporaryInput.style.opacity = '0';
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand('copy');
    temporaryInput.remove();
    if (!copied) throw new Error('Clipboard copy was rejected.');
}

function parseCoordinateLine(line) {
    const hemisphereMatches = [...line.matchAll(/[NSEW]/gi)];
    const latitudeDirection = hemisphereMatches.find(match => /[NS]/i.test(match[0]));
    const longitudeDirection = hemisphereMatches.find(match => /[EW]/i.test(match[0]));
    const unsignedNumberPattern = /\d+(?:\.\d+)?/g;
    const extractComponents = text => (text.match(unsignedNumberPattern) || []).map(Number);

    let latitude;
    let longitude;
    if (latitudeDirection && longitudeDirection) {
        const firstDirection = hemisphereMatches[0];
        const secondDirection = hemisphereMatches[1];
        if (!firstDirection || !secondDirection) return null;

        const beforeFirstDirection = line.slice(0, firstDirection.index);
        const betweenDirections = line.slice(firstDirection.index + 1, secondDirection.index);
        const afterSecondDirection = line.slice(secondDirection.index + 1);
        const firstDirectionIsSuffix = extractComponents(beforeFirstDirection).length > 0;
        const latitudeText = firstDirectionIsSuffix ? beforeFirstDirection : betweenDirections;
        const longitudeText = firstDirectionIsSuffix ? betweenDirections : afterSecondDirection;

        const convertAxis = (text, direction, maxDegrees) => {
            const parts = extractComponents(text);
            if (parts.length < 1 || parts.length > 3) return NaN;
            const [degrees, minutes = 0, seconds = 0] = parts;
            if (minutes >= 60 || seconds >= 60 || Math.abs(degrees) > maxDegrees ||
                (Math.abs(degrees) === maxDegrees && (minutes > 0 || seconds > 0))) return NaN;
            const sign = /[SW]/i.test(direction[0]) ? -1 : 1;
            return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
        };

        latitude = convertAxis(latitudeText, latitudeDirection, 90);
        longitude = convertAxis(longitudeText, longitudeDirection, 180);
    } else {
        const numbers = line.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number) || [];
        if (numbers.length !== 2) return null;
        [latitude, longitude] = numbers;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { lat: latitude, lon: longitude };
}

function formatBoundaryCoordinate(point, format) {
    const formatAxis = (value, isLatitude, outputFormat) => {
        const hemisphere = isLatitude
            ? (value >= 0 ? 'N' : 'S')
            : (value >= 0 ? 'E' : 'W');
        const degreeWidth = isLatitude ? 2 : 3;

        if (outputFormat === 'DD') return `${value.toFixed(6)}°`;
        if (outputFormat === 'DMS') {
            const totalTenthsOfSeconds = Math.round(Math.abs(value) * 3600 * 10);
            const degrees = Math.floor(totalTenthsOfSeconds / 36000);
            const remainingTenths = totalTenthsOfSeconds % 36000;
            const minutes = Math.floor(remainingTenths / 600);
            const seconds = (remainingTenths % 600) / 10;
            return `${String(degrees).padStart(degreeWidth, '0')}° ${String(minutes).padStart(2, '0')}' ${seconds.toFixed(1).padStart(4, '0')}" ${hemisphere}`;
        }

        const totalHundredthsOfMinutes = Math.round(Math.abs(value) * 60 * 10000);
        const degrees = Math.floor(totalHundredthsOfMinutes / 600000);
        const minutesValue = (totalHundredthsOfMinutes % 600000) / 10000;
        const paddedDegrees = String(degrees).padStart(degreeWidth, '0');
        return `${paddedDegrees}° ${(minutesValue).toFixed(4).padStart(7, '0')}' ${hemisphere}`;
    };

    if (format === 'DD') return `${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`;
    return `${formatAxis(point.lat, true, format)} / ${formatAxis(point.lon, false, format)}`;
}

function plotCoordinateBoundary() {
    const input = document.getElementById('boundaryCoordinates');
    const status = document.getElementById('boundaryStatus');
    const copyButton = document.getElementById('copyBoundaryBtn');
    const lines = input.value.split(/\r?\n/)
        .map((line, index) => ({ text: line.trim(), line: index + 1 }))
        .filter(line => line.text);
    const coordinates = lines.map(line => ({ point: parseCoordinateLine(line.text), line: line.line }));
    const invalidLines = coordinates.filter(result => !result.point).map(result => result.line);

    if (lines.length < 3) {
        status.textContent = 'Enter at least three valid coordinate pairs to create a boundary.';
        copyButton.disabled = true;
        return;
    }
    if (invalidLines.length) {
        status.textContent = `Could not read coordinate line${invalidLines.length > 1 ? 's' : ''} ${invalidLines.join(', ')}. Use decimal degrees or degrees/minutes/seconds with N/S/E/W.`;
        copyButton.disabled = true;
        return;
    }

    plottedBoundaryCoordinates = coordinates.map(result => result.point);
    const normalizedDDM = plottedBoundaryCoordinates
        .map(point => formatBoundaryCoordinate(point, 'DDM'))
        .join('\n');
    if (input.value !== normalizedDDM) {
        input.value = normalizedDDM;
        updateBoundaryPointCount();
    }
    boundaryNeedsReplot = false;
    if (plottedBoundaryLayer) map.removeLayer(plottedBoundaryLayer);

    const latLngs = plottedBoundaryCoordinates.map(point => [point.lat, point.lon]);
    plottedBoundaryLayer = L.layerGroup([
        L.polygon(latLngs, {
            color: '#ff2d2d',
            weight: 4,
            opacity: 0.95,
            fillColor: '#ff2d2d',
            fillOpacity: 0.12
        }),
        ...latLngs.map(latLng => L.circleMarker(latLng, {
            radius: 5,
            color: '#b00000',
            weight: 2,
            fillColor: '#ff4d4d',
            fillOpacity: 1
        }))
    ]).addTo(map);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32], maxZoom: 14 });
    copyButton.disabled = false;
    document.getElementById('clearBoundaryBtn').disabled = false;
    const metrics = getBoundaryMetrics(plottedBoundaryCoordinates);
    document.getElementById('boundaryPerimeterNM').textContent = metrics.perimeterNM.toFixed(2);
    document.getElementById('boundaryPerimeterMI').textContent = (metrics.perimeterNM * nauticalMileToMiles).toFixed(2);
    document.getElementById('boundaryAreaSqNM').textContent = metrics.areaSqNM.toFixed(2);
    document.getElementById('boundaryAreaSqMI').textContent = (metrics.areaSqNM * nauticalMileToMiles ** 2).toFixed(2);
    status.textContent = `Boundary plotted with ${plottedBoundaryCoordinates.length} points. Choose a format and copy the coordinates.`;
}

document.getElementById('plotBoundaryBtn').addEventListener('click', plotCoordinateBoundary);
document.getElementById('boundaryCoordinates').addEventListener('input', () => {
    updateBoundaryPointCount();
    if (plottedBoundaryCoordinates.length) {
        boundaryNeedsReplot = true;
        document.getElementById('copyBoundaryBtn').disabled = true;
        document.getElementById('boundaryStatus').textContent = 'Coordinates changed. Plot again before copying the updated boundary.';
    }
});
document.getElementById('clearBoundaryBtn').addEventListener('click', () => {
    if (plottedBoundaryLayer) map.removeLayer(plottedBoundaryLayer);
    plottedBoundaryLayer = null;
    plottedBoundaryCoordinates = [];
    boundaryNeedsReplot = false;
    document.getElementById('boundaryCoordinates').value = '';
    updateBoundaryPointCount();
    document.getElementById('copyBoundaryBtn').disabled = true;
    document.getElementById('clearBoundaryBtn').disabled = true;
    ['boundaryPerimeterNM', 'boundaryPerimeterMI', 'boundaryAreaSqNM', 'boundaryAreaSqMI'].forEach(id => {
        document.getElementById(id).textContent = '—';
    });
    document.getElementById('boundaryStatus').textContent = 'Boundary cleared.';
});
updateBoundaryPointCount();

function degreesToRadians(value) {
    return value * Math.PI / 180;
}

function calculateInitialBearing(pointA, pointB) {
    const latA = degreesToRadians(pointA.lat);
    const latB = degreesToRadians(pointB.lat);
    const deltaLon = degreesToRadians(pointB.lon - pointA.lon);
    const y = Math.sin(deltaLon) * Math.cos(latB);
    const x = Math.cos(latA) * Math.sin(latB) -
        Math.sin(latA) * Math.cos(latB) * Math.cos(deltaLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

document.getElementById('calculateNavigationBtn').addEventListener('click', () => {
    const pointA = parseCoordinateLine(document.getElementById('navigationPointA').value.trim());
    const pointB = parseCoordinateLine(document.getElementById('navigationPointB').value.trim());
    const status = document.getElementById('navigationStatus');
    if (!pointA || !pointB) {
        status.textContent = 'Enter two valid coordinate pairs. Decimal degrees, DDM, and DMS are supported.';
        return;
    }

    const distanceNM = getDistanceNM(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
    const distanceMI = distanceNM * nauticalMileToMiles;
    document.getElementById('navigationBearing').textContent = `${calculateInitialBearing(pointA, pointB).toFixed(1)}°`;
    document.getElementById('navigationDistanceNM').textContent = distanceNM.toFixed(2);
    document.getElementById('navigationDistanceMI').textContent = distanceMI.toFixed(2);
    status.textContent = 'Initial bearing and distance calculated.';
});

document.getElementById('copyPinBtn').addEventListener('click', async () => {
    if (!marker) return;
    const position = marker.getLatLng();
    const ddmText = formatBoundaryCoordinate({ lat: position.lat, lon: position.lng }, 'DDM');
    const status = document.getElementById('pinActionStatus');
    try {
        await copyTextToClipboard(ddmText);
        status.textContent = 'Current pin copied as DDM.';
    } catch (error) {
        status.textContent = `Copy failed. Coordinates: ${ddmText}`;
    }
});

document.getElementById('measureFromPinBtn').addEventListener('click', () => {
    if (marker) startMeasureFromWaypoint(marker.getLatLng());
});

document.getElementById('clearPinBtn').addEventListener('click', () => {
    if (!marker) return;
    map.removeLayer(marker);
    marker = null;
    updatePinActionButtons();
    document.getElementById('pinActionStatus').textContent = 'Map pin cleared.';
    clearURLParams();
});
document.getElementById('copyBoundaryBtn').addEventListener('click', async event => {
    if (!plottedBoundaryCoordinates.length || boundaryNeedsReplot) return;
    const format = document.getElementById('boundaryFormat').value;
    const text = plottedBoundaryCoordinates.map(point => formatBoundaryCoordinate(point, format)).join('\n');
    const status = document.getElementById('boundaryStatus');
    try {
        await copyTextToClipboard(text);
        status.textContent = `${plottedBoundaryCoordinates.length} coordinates copied as ${format}.`;
        const button = event.currentTarget;
        const oldText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = oldText; }, 1200);
    } catch (error) {
        status.textContent = 'Clipboard access is unavailable. Select and copy the coordinate lines manually.';
    }
});

// Layer 1: Street (Cached)
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
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
    if (boundaryDrawing) {
        addBoundaryDrawingPoint(e.latlng);
        return;
    }
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    updateMarker(lat, lon);
    populateInputs(lat, lon);
    calculateResults(lat, lon);
});

// --- URL CENTRAL SYNC FUNCTION ---
// Handles writing all current UI and map states directly into URL parameters
function saveCurrentMapView() {
    const center = map.getCenter();
    let activeBase = 'street';
    if (map.hasLayer(satelliteLayer)) activeBase = 'satellite';
    else if (map.hasLayer(topoLayer)) activeBase = 'topo';

    const activeOverlays = [];
    if (map.hasLayer(nauticalLayers.openseamap)) activeOverlays.push('openseamap');
    if (map.hasLayer(nauticalLayers.noaa)) activeOverlays.push('noaa');

    try {
        localStorage.setItem(savedMapViewKey, JSON.stringify({
            lat: center.lat,
            lon: center.lng,
            zoom: map.getZoom(),
            base: activeBase,
            overlays: activeOverlays
        }));
    } catch (error) {
        console.warn('Could not save the last map view.', error);
    }
}

function syncURL() {
    const url = new URL(window.location);
    const center = map.getCenter();
    saveCurrentMapView();
    url.searchParams.set('viewLat', center.lat.toFixed(6));
    url.searchParams.set('viewLon', center.lng.toFixed(6));
    url.searchParams.set('viewZoom', map.getZoom());

    // Save map coordinate if a marker exists
    if (marker) {
        const pos = marker.getLatLng();
        url.searchParams.set('lat', pos.lat.toFixed(6));
        url.searchParams.set('lon', pos.lng.toFixed(6));
    } else {
        url.searchParams.delete('lat');
        url.searchParams.delete('lon');
    }

    // Keep the legacy zoom parameter for older shared URLs.
    url.searchParams.set('zoom', map.getZoom());

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

// Bind viewport pan, zooms, and layer changes to the central URL sync and saved view.
map.on('moveend zoomend baselayerchange', syncURL);
window.addEventListener('pagehide', saveCurrentMapView);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentMapView();
});

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

    updatePinActionButtons();

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
            copyTextToClipboard(tempDiv.innerText)
                .then(() => { document.getElementById('pinActionStatus').textContent = 'Current pin copied as DDM.'; })
                .catch(() => { document.getElementById('pinActionStatus').textContent = 'Could not access the clipboard.'; });
        }
    } else if (action === 'clear') {
        if (marker) {
            map.removeLayer(marker);
            marker = null;
            updatePinActionButtons();
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

async function copyResult(id, btn) {
    try {
        await copyTextToClipboard(document.getElementById(id).innerText);
        const old = btn.innerText;
        btn.innerText = "✓";
        setTimeout(() => btn.innerText = old, 1000);
    } catch (error) {
        const old = btn.innerText;
        btn.innerText = "Copy failed";
        setTimeout(() => btn.innerText = old, 1500);
    }
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
    if (!isMeasuring && boundaryDrawing) {
        stopBoundaryDrawing('Boundary drawing canceled because distance measurement was started.');
    }
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
    if (boundaryDrawing) stopBoundaryDrawing('Boundary drawing canceled because distance measurement was started.');
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
    if (hasUrlCoords) {
        updateMarker(initialLat, initialLon, false); 
        populateInputs(initialLat, initialLon);
        calculateResults(initialLat, initialLon);
    }
    updatePinActionButtons();
    saveCurrentMapView();
}

// Safely execute initial values even if page loaded faster than event assignment
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeApp();
} else {
    window.addEventListener('DOMContentLoaded', initializeApp);
}
