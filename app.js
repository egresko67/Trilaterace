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

// Inicializace Firebase
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
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const resetViewBtn = document.getElementById('reset-view');
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

function toCanvas(coord) {
    const scale = canvas.width / MAP_SIZE;
    return (parseFloat(coord) + OFFSET) * scale;
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight);
    canvas.width = size;
    canvas.height = size;
    render();
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
        render();
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

// --- RENDER OVÁNÍ ---

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const step = canvas.width / 8; 
    for (let i = 0; i <= canvas.width; i += step) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();

    // Coordinates labels
    ctx.fillStyle = '#475569';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText("-200", 5, canvas.height / 2 - 5);
    ctx.fillText("200", canvas.width - 25, canvas.height / 2 - 5);
    ctx.fillText("-200", canvas.width / 2 + 5, 15);
    ctx.fillText("200", canvas.width / 2 + 5, canvas.height - 5);

    // Circles
    measurements.forEach(m => {
        const cx = toCanvas(m.x);
        const cz = toCanvas(m.z);
        const cr = m.r * (canvas.width / MAP_SIZE);

        const grad = ctx.createRadialGradient(cx, cz, 0, cx, cz, cr);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.1)');

        ctx.beginPath();
        ctx.arc(cx, cz, cr, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cz, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    drawIntersections();
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

function drawIntersections() {
    intersections.forEach(p => {
        const px = toCanvas(p.x);
        const pz = toCanvas(p.z);
        
        ctx.beginPath();
        ctx.arc(px, pz, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f59e0b';
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
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

// --- INTERAKCE ---

canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    
    // Scale mouse coordinates to match canvas internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    
    let found = false;
    for (const p of intersections) {
        const px = toCanvas(p.x);
        const pz = toCanvas(p.z);
        const dist = Math.sqrt((mx - px)**2 + (my - pz)**2);
        
        if (dist < 10) {
            hoverInfo.style.display = 'block';
            
            // Position tooltip relative to the cursor (in CSS pixels)
            const cssMx = e.clientX - rect.left;
            const cssMy = e.clientY - rect.top;
            
            hoverInfo.style.left = `${cssMx + 15}px`;
            hoverInfo.style.top = `${cssMy + 15}px`;
            hoverInfo.innerHTML = `<strong>Odhad vejce</strong><br>X: ${p.x.toFixed(1)}<br>Z: ${p.z.toFixed(1)}`;
            canvas.style.cursor = 'crosshair';
            found = true;
            break;
        }
    }
    
    if (!found) {
        hoverInfo.style.display = 'none';
        canvas.style.cursor = 'default';
    }
};

// --- INICIALIZACE ---

window.addEventListener('resize', resizeCanvas);
resetViewBtn.onclick = resizeCanvas;

updateDateDisplay();
updateResetTimer();
resizeCanvas();
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
