import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCoMnZyBg6IV6H_NPuX40c2dbrChCkYPCs",
  authDomain: "trilaterace.firebaseapp.com",
  databaseURL: "https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app", 
  projectId: "trilaterace",
  storageBucket: "trilaterace.firebasestorage.app",
  messagingSenderId: "542609606032",
  appId: "1:542609606032:web:b9fa594544d7e429f15f15"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let measurements = []; // LOCAL ONLY
let intersections = []; // Matches from pool
let confirmedEggs = []; // Global pool
let poolLocations = []; // Global pool (unique)
const OFFSET = 200; 

const form = document.getElementById('measurement-form');
const xInput = document.getElementById('x-coord');
const yInput = document.getElementById('y-coord');
const zInput = document.getElementById('z-coord');
const rInput = document.getElementById('radius');
const tableBody = document.querySelector('#measurements-table tbody');
const targetsTableBody = document.querySelector('#targets-table tbody');
const confirmedTableBody = document.querySelector('#confirmed-table tbody');
const countSpan = document.getElementById('count');
const dateSpan = document.getElementById('current-date');
const mapContainer = document.getElementById('map-container');
const layers = {
    grid: document.getElementById('svg-grid-layer'),
    pool: document.getElementById('svg-pool-layer'),
    circles: document.getElementById('svg-circles-layer'),
    intersections: document.getElementById('svg-intersections-layer'),
    players: document.getElementById('svg-players-layer')
};
const hoverInfo = document.getElementById('hover-info');
const cursorCoords = document.getElementById('cursor-coords');
const mapSvg = document.getElementById('map-svg');
const viewport = document.getElementById('svg-viewport');
const toggleCircles = document.getElementById('toggle-circles');
const resetButton = document.getElementById('reset-view');

let viewState = { x: 0, y: 0, zoom: 1, isDragging: false, startX: 0, startY: 0 };

// --- ZOOM & PAN ---
mapSvg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = mapSvg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width * 400;
    const mouseY = (e.clientY - rect.top) / rect.height * 400;
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    const newZoom = Math.min(Math.max(viewState.zoom * factor, 1.0), 15);
    const actualFactor = newZoom / viewState.zoom;
    viewState.x = mouseX - (mouseX - viewState.x) * actualFactor;
    viewState.y = mouseY - (mouseY - viewState.y) * actualFactor;
    viewState.zoom = newZoom;
    updateViewTransformation();
});

mapSvg.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    viewState.isDragging = true;
    const rect = mapSvg.getBoundingClientRect();
    const scale = 400 / rect.width;
    viewState.startX = e.clientX * scale - viewState.x;
    viewState.startY = e.clientY * scale - viewState.y;
});

window.addEventListener('mousemove', (e) => {
    if (viewState.isDragging) {
        const rect = mapSvg.getBoundingClientRect();
        const scale = 400 / rect.width;
        viewState.x = e.clientX * scale - viewState.startX;
        viewState.y = e.clientY * scale - viewState.startY;
        updateViewTransformation();
    }
    const rect = mapSvg.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const svgPoint = mapSvg.createSVGPoint();
        svgPoint.x = e.clientX;
        svgPoint.y = e.clientY;
        const transformedPoint = svgPoint.matrixTransform(viewport.getScreenCTM().inverse());
        const x = Math.round(transformedPoint.x - OFFSET);
        const z = Math.round(transformedPoint.y - OFFSET);
        cursorCoords.textContent = `X: ${x}, Z: ${z}`;
        cursorCoords.style.opacity = '1';
    }
});

window.addEventListener('mouseup', () => { viewState.isDragging = false; });

function updateViewTransformation() {
    const minPan = 400 * (1 - viewState.zoom);
    viewState.x = Math.min(Math.max(viewState.x, minPan), 0);
    viewState.y = Math.min(Math.max(viewState.y, minPan), 0);
    viewport.setAttribute('transform', `translate(${viewState.x}, ${viewState.y}) scale(${viewState.zoom})`);
}

resetButton.addEventListener('click', () => {
    viewState = { x: 0, y: 0, zoom: 1, isDragging: false, startX: 0, startY: 0 };
    updateViewTransformation();
});

toggleCircles.addEventListener('change', () => {
    layers.circles.style.display = toggleCircles.checked ? 'block' : 'none';
});

// --- POMOCNÉ FUNKCE ---
function toCoord(val) { return parseFloat(val) + OFFSET; }
function getCurrentDateStr() { return new Date().toISOString().split('T')[0]; }

function getConfidenceColor(conf) {
    if (conf >= 3) return '#22c55e'; // Vysoká shoda (3+ měření)
    if (conf >= 2) return '#fbbf24'; // Střední shoda (2 měření)
    if (conf >= 1) return '#f97316'; // Nízká shoda (1 měření)
    return '#94a3b8';
}

function highlightMeasurement(id) {
    document.querySelectorAll('.svg-measurement-circle').forEach(c => {
        if (c.getAttribute('data-id') === id) {
            c.style.opacity = "1";
            c.style.strokeWidth = "2";
        } else {
            c.style.opacity = "0.05";
        }
    });
}

function resetHighlight() {
    document.querySelectorAll('.svg-measurement-circle').forEach(c => {
        c.style.opacity = "0.15";
        c.style.strokeWidth = "1";
    });
}

// --- DATA ---
function loadData() {
    const dateStr = getCurrentDateStr();
    dateSpan.textContent = dateStr;
    
    // Load ALL confirmed eggs (across all dates) to act as a global pool
    onValue(ref(db, `confirmed_eggs`), (snap) => {
        const allData = snap.val();
        if (allData) {
            let allEggs = [];
            Object.entries(allData).forEach(([date, eggs]) => {
                Object.entries(eggs).forEach(([id, v]) => {
                    allEggs.push({ id, date, ...v });
                });
            });
            const unique = [];
            const seen = new Set();
            allEggs.forEach(e => {
                const key = `${Math.round(e.x)}|${Math.round(e.z)}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(e);
                }
            });
            confirmedEggs = unique;
            poolLocations = unique;
        } else {
            confirmedEggs = [];
            poolLocations = [];
        }
        processAll();
    });
}

function processAll() {
    calculatePoolMatches();
    updateUI();
    renderSVG();
}

function calculatePoolMatches() {
    if (measurements.length === 0) {
        intersections = [];
        return;
    }

    let candidates = [];
    poolLocations.forEach(egg => {
        let support = 0;
        let totalError = 0;
        
        measurements.forEach(m => {
            const dist = Math.sqrt(Math.pow(egg.x - m.x, 2) + Math.pow(egg.y - m.y, 2) + Math.pow(egg.z - m.z, 2));
            const error = Math.abs(dist - m.r);
            if (error < 6) { // Tolerance 6 bloků
                support++;
                totalError += error;
            }
        });

        if (support > 0) {
            candidates.push({
                ...egg,
                confidence: support,
                quality: Math.max(0, 100 - Math.round(totalError / support * 10))
            });
        }
    });

    candidates.sort((a, b) => (b.confidence * 1000 + b.quality) - (a.confidence * 1000 + a.quality));
    intersections = candidates.slice(0, 20); // Top 20 shod
}

function updateUI() {
    countSpan.textContent = measurements.length;
    tableBody.innerHTML = '';
    [...measurements].sort((a,b)=>b.timestamp-a.timestamp).forEach(m => {
        const tr = document.createElement('tr');
        tr.onmouseenter = () => highlightMeasurement(m.id);
        tr.onmouseleave = () => resetHighlight();
        tr.innerHTML = `<td><span class="mono">${Math.round(m.x)} / ${Math.round(m.y)} / ${Math.round(m.z)}</span></td><td>${m.r}</td><td><button class="btn-del-small" onclick="deleteMeasurement('${m.id}')">✕</button></td>`;
        tableBody.appendChild(tr);
    });
    targetsTableBody.innerHTML = '';
    intersections.forEach(p => {
        const tr = document.createElement('tr');
        const color = getConfidenceColor(p.confidence);
        tr.innerHTML = `<td><span class="mono clickable" onclick="focusOnPoint(${p.x},${p.z})">${p.x} / ${p.y} / ${p.z}</span><div style="font-size: 0.6rem; color: #94a3b8">Shoda: ${p.quality}%</div></td><td><span class="badge" style="color:${color}">${p.confidence}x</span></td><td><button class="btn-primary" style="padding:4px 8px; font-size:0.7rem" onclick="confirmEgg(${p.x},${p.y},${p.z})">Ok</button></td>`;
        targetsTableBody.appendChild(tr);
    });
    confirmedTableBody.innerHTML = '';
    confirmedEggs.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><span class="mono clickable" onclick="focusOnPoint(${e.x},${e.z})">${Math.round(e.x)} / ${Math.round(e.y)} / ${Math.round(e.z)}</span></td><td><button class="btn-del-small" onclick="deleteEgg('${e.id}', '${e.date}')">✕</button></td>`;
        confirmedTableBody.appendChild(tr);
    });
}

function renderSVG() {
    layers.grid.innerHTML = '';
    const step = 50;
    for (let i = 0; i <= 400; i += step) {
        const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vLine.setAttribute("x1", i); vLine.setAttribute("y1", 0); vLine.setAttribute("x2", i); vLine.setAttribute("y2", 400);
        vLine.setAttribute("class", i === 200 ? "svg-axis-line" : "svg-grid-line");
        layers.grid.appendChild(vLine);
        const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hLine.setAttribute("x1", 0); hLine.setAttribute("y1", i); hLine.setAttribute("x2", 400); hLine.setAttribute("y2", i);
        hLine.setAttribute("class", i === 200 ? "svg-axis-line" : "svg-grid-line");
        layers.grid.appendChild(hLine);
    }

    layers.pool.innerHTML = '';
    poolLocations.forEach(p => {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", toCoord(p.x)); c.setAttribute("cy", toCoord(p.z));
        c.setAttribute("r", 1.5);
        c.style.fill = "rgba(148, 163, 184, 0.2)";
        c.style.stroke = "none";
        c.onmouseenter = (e) => showPoolTooltip(e, p);
        c.onmouseleave = hideTooltip;
        layers.pool.appendChild(c);
    });

    layers.circles.innerHTML = '';
    measurements.forEach(m => {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", toCoord(m.x)); c.setAttribute("cy", toCoord(m.z));
        c.setAttribute("r", m.r); c.setAttribute("class", "svg-measurement-circle");
        c.setAttribute("data-id", m.id);
        c.style.fill = "none"; c.style.stroke = "var(--primary)"; c.style.opacity = "0.15";
        layers.circles.appendChild(c);
    });
    layers.players.innerHTML = '';
    measurements.forEach(m => {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", toCoord(m.x)); c.setAttribute("cy", toCoord(m.z));
        c.setAttribute("r", 1.5); c.setAttribute("class", "svg-player-point");
        c.style.fill = "var(--danger)"; c.style.stroke = "white"; c.style.strokeWidth = "0.5";
        layers.players.appendChild(c);
    });
    layers.intersections.innerHTML = '';
    intersections.forEach(p => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", toCoord(p.x)); c.setAttribute("cy", toCoord(p.z));
        c.setAttribute("r", 4 + p.confidence);
        c.style.fill = getConfidenceColor(p.confidence);
        c.style.stroke = "white";
        c.style.strokeWidth = "1";
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", toCoord(p.x)-3); text.setAttribute("y", toCoord(p.z)+3);
        text.setAttribute("font-size", "6"); text.textContent = "🥚";
        
        g.style.cursor = "pointer";
        g.onmouseenter = (e) => showTooltip(e, p);
        g.onmouseleave = hideTooltip;
        
        g.appendChild(c); g.appendChild(text);
        layers.intersections.appendChild(g);
    });
}

// --- GLOBÁLNÍ FUNKCE ---
window.deleteMeasurement = (id) => { 
    measurements = measurements.filter(m => m.id !== id);
    processAll();
};
window.deleteAllMeasurements = () => { 
    if(confirm("Smazat lokální měření?")) {
        measurements = [];
        processAll();
    }
};
window.deleteEgg = (id, date) => {
    if(confirm("Opravdu smazat toto vejce z globální databáze?")) {
        remove(ref(db, `confirmed_eggs/${date}/${id}`));
    }
};
window.confirmEgg = async (x, y, z) => { 
    const dateStr = getCurrentDateStr(); 
    await push(ref(db, `confirmed_eggs/${dateStr}`), { x: Math.round(x), y: Math.round(y), z: Math.round(z), timestamp: Date.now() }); 
};
window.addManualEgg = async () => { 
    const x = document.getElementById('conf-x').value; 
    const y = document.getElementById('conf-y').value; 
    const z = document.getElementById('conf-z').value; 
    if (x && y && z) { 
        await window.confirmEgg(x, y, z); 
        document.getElementById('conf-x').value = ''; 
        document.getElementById('conf-y').value = ''; 
        document.getElementById('conf-z').value = ''; 
    } 
};

function showTooltip(e, p) {
    hoverInfo.style.display = 'block';
    hoverInfo.innerHTML = `<strong>Potenciální shoda</strong><br>X: ${p.x}<br>Y: ${p.y}<br>Z: ${p.z}<br><small>Shoda: ${p.quality}%</small><br><small>Podpořeno ${p.confidence} měřeními</small>`;
    moveTooltip(e);
}

function showPoolTooltip(e, p) {
    hoverInfo.style.display = 'block';
    hoverInfo.innerHTML = `<strong>Možná lokace (Pool)</strong><br>X: ${p.x}<br>Y: ${p.y}<br>Z: ${p.z}`;
    moveTooltip(e);
}

function moveTooltip(e) {
    const rect = hoverInfo.getBoundingClientRect();
    const padding = 15;
    let x = e.clientX + padding;
    let y = e.clientY + padding;
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - padding;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - padding;
    hoverInfo.style.position = 'fixed';
    hoverInfo.style.left = `${x}px`;
    hoverInfo.style.top = `${y}px`;
}
function hideTooltip() { hoverInfo.style.display = 'none'; }
window.focusOnPoint = (x, z) => { viewState.zoom = 2; viewState.x = 200 - (x+OFFSET)*2; viewState.y = 200 - (z+OFFSET)*2; updateViewTransformation(); };

form.onsubmit = (e) => { 
    e.preventDefault(); 
    const newM = { 
        id: "loc_" + Date.now(),
        x: parseFloat(xInput.value), 
        y: parseFloat(yInput.value), 
        z: parseFloat(zInput.value), 
        r: parseFloat(rInput.value), 
        timestamp: Date.now() 
    };
    measurements.push(newM);
    form.reset(); 
    processAll();
};

loadData();
