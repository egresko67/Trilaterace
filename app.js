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
const yInput = document.getElementById('y-coord');
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
const cursorCoords = document.getElementById('cursor-coords');

const mapSvg = document.getElementById('map-svg');
const viewport = document.getElementById('svg-viewport');
const toggleCircles = document.getElementById('toggle-circles');
const resetButton = document.getElementById('reset-view');

let viewState = {
    x: 0,
    y: 0,
    zoom: 1,
    isDragging: false,
    startX: 0,
    startY: 0
};

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

mapSvg.addEventListener('mouseenter', () => {
    cursorCoords.style.opacity = '1';
});

mapSvg.addEventListener('mouseleave', () => {
    cursorCoords.style.opacity = '0';
});

window.addEventListener('mousemove', (e) => {
    if (viewState.isDragging) {
        const rect = mapSvg.getBoundingClientRect();
        const scale = 400 / rect.width;
        viewState.x = e.clientX * scale - viewState.startX;
        viewState.y = e.clientY * scale - viewState.startY;
        updateViewTransformation();
    }

    // Update cursor coordinates
    const rect = mapSvg.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const x = Math.round(((e.clientX - rect.left) / rect.width * 400) - OFFSET);
        const z = Math.round(((e.clientY - rect.top) / rect.height * 400) - OFFSET);
        cursorCoords.textContent = `X: ${x}, Z: ${z}`;
    }
});

window.addEventListener('mouseup', () => {
    viewState.isDragging = false;
});

function updateViewTransformation() {
    const minPan = 400 * (1 - viewState.zoom);
    const maxPan = 0;
    viewState.x = Math.min(Math.max(viewState.x, minPan), maxPan);
    viewState.y = Math.min(Math.max(viewState.y, minPan), maxPan);
    viewport.setAttribute('transform', `translate(${viewState.x}, ${viewState.y}) scale(${viewState.zoom})`);
}

resetButton.addEventListener('click', () => {
    viewState = { x: 0, y: 0, zoom: 1, isDragging: false, startX: 0, startY: 0 };
    updateViewTransformation();
});

toggleCircles.addEventListener('change', () => {
    layers.circles.classList.toggle('hidden', !toggleCircles.checked);
});

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

function getConfidenceColor(conf) {
    if (conf >= 4) return 'var(--success)';
    if (conf >= 3) return '#fbbf24';
    if (conf >= 2) return 'var(--accent)';
    return 'var(--text-dim)';
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
        tr.setAttribute('data-id', m.id);
        tr.innerHTML = `
            <td><span class="mono">${m.x} / ${m.y || 0} / ${m.z}</span></td>
            <td><span class="mono">${m.r}</span></td>
            <td><button class="btn-del-small" data-id="${m.id}" title="Smazat">✕</button></td>
        `;
        tr.onmouseenter = () => highlightMeasurement(m.id);
        tr.onmouseleave = () => resetHighlight();
        tableBody.appendChild(tr);
    });
    document.querySelectorAll('.btn-del-small').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            deleteMeasurement(btn.dataset.id);
        };
    });
}

function highlightMeasurement(id) {
    document.querySelectorAll('.svg-measurement-circle').forEach(c => {
        if (c.getAttribute('data-id') === id) {
            c.classList.add('highlight');
        } else {
            c.classList.add('dimmed');
        }
    });
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.classList.add('highlight-row');
}

function resetHighlight() {
    document.querySelectorAll('.svg-measurement-circle').forEach(c => {
        c.classList.remove('highlight', 'dimmed');
    });
    document.querySelectorAll('tr').forEach(r => r.classList.remove('highlight-row'));
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
        y: parseFloat(yInput.value),
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

        // Grid labels
        if (i % 100 === 0 || i === 200) {
            const val = i - OFFSET;
            const xText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            xText.setAttribute("x", i + 2);
            xText.setAttribute("y", 12);
            xText.setAttribute("class", "svg-grid-text");
            xText.textContent = val;
            layers.grid.appendChild(xText);

            const zText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            zText.setAttribute("x", 2);
            zText.setAttribute("y", i - 2);
            zText.setAttribute("class", "svg-grid-text");
            zText.textContent = val;
            layers.grid.appendChild(zText);
        }
    }

    layers.circles.innerHTML = '';
    const circleOpacity = Math.max(0.1, 0.4 - (measurements.length * 0.02));
    measurements.forEach(m => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", toCoord(m.x));
        circle.setAttribute("cy", toCoord(m.z));
        circle.setAttribute("r", m.r);
        circle.setAttribute("fill", "url(#circle-grad)");
        circle.setAttribute("stroke", "rgba(56, 189, 248, 0.5)");
        circle.setAttribute("stroke-width", "1");
        circle.setAttribute("class", "svg-measurement-circle");
        circle.setAttribute("data-id", m.id);
        circle.style.opacity = circleOpacity;
        layers.circles.appendChild(circle);
    });

    layers.intersections.innerHTML = '';
    intersections.forEach((p) => {
        const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        point.setAttribute("cx", toCoord(p.x));
        point.setAttribute("cy", toCoord(p.z));
        const confColor = getConfidenceColor(p.confidence);
        const radius = p.isMajor ? Math.min(6 + p.confidence, 12) : 5;
        point.setAttribute("r", radius);
        point.setAttribute("class", "svg-poi-point");
        point.style.fill = confColor;
        if (p.isMajor) {
            point.style.filter = `drop-shadow(0 0 ${p.confidence * 2}px ${confColor})`;
        }
        const anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        anim.setAttribute("attributeName", "r");
        anim.setAttribute("values", `${radius-0.5};${radius+0.5};${radius-0.5}`);
        anim.setAttribute("dur", p.isMajor ? "1.5s" : "3s");
        anim.setAttribute("repeatCount", "indefinite");
        point.appendChild(anim);
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
        point.setAttribute("r", "2"); // Reduced from 3.5 to 2
        point.setAttribute("class", "svg-player-point");
        point.style.fill = 'var(--danger)';
        layers.players.appendChild(point);
    });
}

function calculateIntersections() {
    let allIntersections = [];
    if (measurements.length < 3) {
        intersections = [];
        return;
    }
    for (let i = 0; i < measurements.length; i++) {
        for (let j = i + 1; j < measurements.length; j++) {
            for (let k = j + 1; k < measurements.length; k++) {
                const pts = getSphereIntersections(measurements[i], measurements[j], measurements[k]);
                if (pts) allIntersections.push(...pts);
            }
        }
    }
    const clusters = [];
    const DISTANCE_THRESHOLD = 8; 
    allIntersections.forEach(p => {
        let addedToCluster = false;
        for (let cluster of clusters) {
            const center = cluster.center;
            const dist = Math.sqrt(
                Math.pow(p.x - center.x, 2) + 
                Math.pow(p.y - center.y, 2) + 
                Math.pow(p.z - center.z, 2)
            );
            if (dist < DISTANCE_THRESHOLD) {
                cluster.points.push(p);
                cluster.center = {
                    x: cluster.points.reduce((sum, pt) => sum + pt.x, 0) / cluster.points.length,
                    y: cluster.points.reduce((sum, pt) => sum + pt.y, 0) / cluster.points.length,
                    z: cluster.points.reduce((sum, pt) => sum + pt.z, 0) / cluster.points.length
                };
                addedToCluster = true;
                break;
            }
        }
        if (!addedToCluster) {
            clusters.push({ center: { x: p.x, y: p.y, z: p.z }, points: [p] });
        }
    });

    // Filtrování šumu: Potřebujeme alespoň několik shod pro zobrazení bodu
    const minConfidence = Math.max(2, Math.floor(measurements.length / 4));

    intersections = clusters
        .map(c => ({
            x: c.center.x,
            y: c.center.y,
            z: c.center.z,
            confidence: c.points.length,
            isMajor: c.points.length >= minConfidence * 2
        }))
        .filter(p => p.confidence >= minConfidence)
        .sort((a, b) => b.confidence - a.confidence);
}

function getSphereIntersections(p1, p2, p3) {
    const P1 = { x: p1.x, y: p1.y || 0, z: p1.z };
    const P2 = { x: p2.x, y: p2.y || 0, z: p2.z };
    const P3 = { x: p3.x, y: p3.y || 0, z: p3.z };
    const r1 = p1.r;
    const r2 = p2.r;
    const r3 = p3.r;

    const dvec = { x: P2.x - P1.x, y: P2.y - P1.y, z: P2.z - P1.z };
    const d = Math.sqrt(dvec.x * dvec.x + dvec.y * dvec.y + dvec.z * dvec.z);
    if (d === 0) return null;
    const ex = { x: dvec.x / d, y: dvec.y / d, z: dvec.z / d };

    const p3p1 = { x: P3.x - P1.x, y: P3.y - P1.y, z: P3.z - P1.z };
    const i = ex.x * p3p1.x + ex.y * p3p1.y + ex.z * p3p1.z;

    const eyvec = { x: p3p1.x - i * ex.x, y: p3p1.y - i * ex.y, z: p3p1.z - i * ex.z };
    const j = Math.sqrt(eyvec.x * eyvec.x + eyvec.y * eyvec.y + eyvec.z * eyvec.z);
    if (j === 0) return null;
    const ey = { x: eyvec.x / j, y: eyvec.y / j, z: eyvec.z / j };

    const ez = {
        x: ex.y * ey.z - ex.z * ey.y,
        y: ex.z * ey.x - ex.x * ey.z,
        z: ex.x * ey.y - ex.y * ey.x
    };

    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    const zSquared = r1 * r1 - x * x - y * y;
    if (zSquared < -0.5) return null; // Tolerance pro zaokrouhlovací chyby
    const z = Math.sqrt(Math.max(0, zSquared));

    const result1 = {
        x: P1.x + x * ex.x + y * ey.x + z * ez.x,
        y: P1.y + x * ex.y + y * ey.y + z * ez.y,
        z: P1.z + x * ex.z + y * ey.z + z * ez.z
    };
    const result2 = {
        x: P1.x + x * ex.x + y * ey.x - z * ez.x,
        y: P1.y + x * ex.y + y * ey.y - z * ez.y,
        z: P1.z + x * ex.z + y * ey.z - z * ez.z
    };

    return [result1, result2];
}

function showTooltip(e, p) {
    hoverInfo.style.display = 'block';
    hoverInfo.innerHTML = `<strong>Odhad vejce</strong><br>X: ${p.x.toFixed(1)}<br>Y: ${p.y.toFixed(1)}<br>Z: ${p.z.toFixed(1)}`;
    moveTooltip(e);
}

function moveTooltip(e) {
    const rect = mapContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hoverInfo.style.left = `${x + 15}px`;
    hoverInfo.style.top = `${y + 15}px`;
}

function hideTooltip() {
    hoverInfo.style.display = 'none';
}

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
