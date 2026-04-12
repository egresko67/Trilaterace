import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove } from "firebase/database";

// --- KONFIGURACE FIREBASE ---
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

// --- STAV APLIKACE ---
let measurements = [];
let intersections = [];
const MAP_SIZE = 400;
const OFFSET = 200; 

// DOM Elementy
const form = document.getElementById('measurement-form');
const xInput = document.getElementById('x-coord');
const zInput = document.getElementById('z-coord');
const rInput = document.getElementById('radius');
const tableBody = document.querySelector('#measurements-table tbody');
const countSpan = document.getElementById('count');
const dateSpan = document.getElementById('current-date');
const timeToResetSpan = document.getElementById('time-to-reset');
const mapContainer = document.getElementById('map-container');
const layers = {
    grid: document.getElementById('svg-grid-layer'),
    circles: document.getElementById('svg-circles-layer'),
    intersections: document.getElementById('svg-intersections-layer'),
    players: document.getElementById('svg-players-layer')
};
const hoverInfo = document.getElementById('hover-info');

// --- POMOCNÉ FUNKCE ---

function getCurrentDateStr() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

function updateDateDisplay() {
    dateSpan.textContent = getCurrentDateStr();
}

function updateResetTimer() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    timeToResetSpan.textContent = `${hours}h ${minutes}m`;
}

function toCoord(val) {
    return parseFloat(val) + OFFSET;
}

// --- LOGIKA DAT ---

function loadData() {
    const dateStr = getCurrentDateStr();
    const dataRef = ref(db, `measurements/${dateStr}`);

    onValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        measurements = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        calculateIntersections();
        updateUI();
        renderSVG();
    });
}

function updateUI() {
    tableBody.innerHTML = '';
    countSpan.textContent = measurements.length;

    measurements.sort((a, b) => b.timestamp - a.timestamp).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="mono">${m.x} / ${m.z}</span></td>
            <td><span class="mono">${m.r}</span></td>
            <td><button class="btn-del-small" data-id="${m.id}" title="Smazat">✕</button></td>
        `;
        tableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-del-small').forEach(btn => {
        btn.onclick = () => deleteMeasurement(btn.dataset.id);
    });
}

async function deleteMeasurement(id) {
    if(!confirm("Opravdu smazat toto měření?")) return;
    try {
        const dateStr = getCurrentDateStr();
        await remove(ref(db, `measurements/${dateStr}/${id}`));
    } catch (error) {
        alert("Chyba při mazání: " + error.message);
    }
}

form.onsubmit = async (e) => {
    e.preventDefault();
    const dateStr = getCurrentDateStr();
    const timestamp = Date.now();
    const newMeasurement = {
        x: parseFloat(xInput.value),
        z: parseFloat(zInput.value),
        r: parseFloat(rInput.value),
        timestamp: timestamp
    };

    try {
        const dataRef = ref(db, `measurements/${dateStr}`);
        const newRef = push(dataRef);
        await set(newRef, newMeasurement);
        form.reset();
    } catch (error) {
        alert("Chyba při odesílání: " + error.message);
    }
};

// --- RENDER OVÁNÍ (SVG) ---

function renderSVG() {
    layers.grid.innerHTML = '';
    const step = 50; 
    for (let i = 0; i <= 400; i += step) {
        const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vLine.setAttribute("x1", i); vLine.setAttribute("y1", 0);
        vLine.setAttribute("x2", i); vLine.setAttribute("y2", 400);
        vLine.setAttribute("class", i === 200 ? "svg-axis-line" : "svg-grid-line");
        layers.grid.appendChild(vLine);

        const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hLine.setAttribute("x1", 0); hLine.setAttribute("y1", i);
        hLine.setAttribute("x2", 400); hLine.setAttribute("y2", i);
        hLine.setAttribute("class", i === 200 ? "svg-axis-line" : "svg-grid-line");
        layers.grid.appendChild(hLine);
    }

    layers.circles.innerHTML = '';
    measurements.forEach(m => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", toCoord(m.x));
        circle.setAttribute("cy", toCoord(m.z));
        circle.setAttribute("r", m.r);
        circle.setAttribute("fill", "url(#circle-grad)");
        circle.setAttribute("stroke", "rgba(56, 189, 248, 0.4)");
        circle.setAttribute("stroke-width", "1.5");
        layers.circles.appendChild(circle);
    });

    layers.intersections.innerHTML = '';
    intersections.forEach(p => {
        const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        point.setAttribute("cx", toCoord(p.x));
        point.setAttribute("cy", toCoord(p.z));
        point.setAttribute("r", "6");
        point.setAttribute("class", "svg-poi-point");
        
        point.addEventListener('mouseenter', (e) => showTooltip(e, p));
        point.addEventListener('mousemove', (e) => moveTooltip(e));
        point.addEventListener('mouseleave', () => hideTooltip());
        
        layers.intersections.appendChild(point);
    });

    layers.players.innerHTML = '';
    measurements.forEach(m => {
        const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        point.setAttribute("cx", toCoord(m.x));
        point.setAttribute("cy", toCoord(m.z));
        point.setAttribute("r", "3.5");
        point.setAttribute("class", "svg-player-point");
        layers.players.appendChild(point);
    });
}

function calculateIntersections() {
    intersections = [];
    if (measurements.length < 2) return;

    for (let i = 0; i < measurements.length; i++) {
        for (let j = i + 1; j < measurements.length; j++) {
            const pts = getCircleIntersections(measurements[i], measurements[j]);
            if (pts) intersections.push(...pts);
        }
    }
}

function getCircleIntersections(c1, c2) {
    const dx = c2.x - c1.x;
    const dz = c2.z - c1.z;
    const d = Math.sqrt(dx * dx + dz * dz);

    if (d > c1.r + c2.r || d < Math.abs(c1.r - c2.r) || d === 0) return null;

    const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a));
    const x2 = c1.x + a * dx / d;
    const z2 = c1.z + a * dz / d;

    const rx = -dz * (h / d);
    const rz = dx * (h / d);

    return [
        { x: x2 + rx, z: z2 + rz },
        { x: x2 - rx, z: z2 - rz }
    ];
}

// --- TOOLTIP ---

function showTooltip(e, p) {
    hoverInfo.style.display = 'block';
    hoverInfo.innerHTML = `<strong>Odhad vejce</strong><br>X: ${p.x.toFixed(1)}<br>Z: ${p.z.toFixed(1)}`;
    moveTooltip(e);
}

function moveTooltip(e) {
    const rect = mapContainer.getBoundingClientRect();
    // Position tooltip relative to the map-container (which is position:relative)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    hoverInfo.style.left = `${x + 15}px`;
    hoverInfo.style.top = `${y + 15}px`;
}

function hideTooltip() {
    hoverInfo.style.display = 'none';
}

// --- INICIALIZACE ---

updateDateDisplay();
updateResetTimer();
loadData();

setInterval(() => {
    updateResetTimer();
    const current = dateSpan.textContent;
    const now = getCurrentDateStr();
    if (current !== now) {
        updateDateDisplay();
        loadData();
    }
}, 30000);
