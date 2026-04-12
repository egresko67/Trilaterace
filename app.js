import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove } from "firebase/database";

// --- KONFIGURACE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCoMnZyBg6IV6H_NPuX40c2dbrChCkYPCs",
  authDomain: "trilaterace.firebaseapp.com",
  databaseURL: "https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app/", 
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
const MAP_SIZE = 400;
const OFFSET = 200; // Centrováno kolem 0,0 (rozsah -200 až 200)

// DOM Elementy
const form = document.getElementById('measurement-form');
const xInput = document.getElementById('x-coord');
const zInput = document.getElementById('z-coord');
const rInput = document.getElementById('radius');
const tableBody = document.querySelector('#measurements-table tbody');
const countSpan = document.getElementById('count');
const dateSpan = document.getElementById('current-date');
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

// --- POMOCNÉ FUNKCE ---

function getCurrentDateStr() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // RRRR-MM-DD
}

function updateDateDisplay() {
    dateSpan.textContent = getCurrentDateStr();
}

// Převod Minecraft souřadnic na pixely canvasu
function toCanvas(coord) {
    // coord: -200 -> 0, 0 -> 200, 200 -> 400
    const scale = canvas.width / MAP_SIZE;
    return (parseFloat(coord) + OFFSET) * scale;
}

function resizeCanvas() {
    const size = canvas.parentElement.clientWidth;
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
            <td>${m.x}</td>
            <td>${m.z}</td>
            <td>${m.r}</td>
            <td>${new Date(m.timestamp).toLocaleTimeString()}</td>
            <td><button class="btn-delete" data-id="${m.id}">Smazat</button></td>
        `;
        tableBody.appendChild(tr);
    });

    // Delegace události pro mazání
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deleteMeasurement(btn.dataset.id);
    });
}

async function deleteMeasurement(id) {
    const dateStr = getCurrentDateStr();
    await remove(ref(db, `measurements/${dateStr}/${id}`));
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
        console.error("Chyba při odesílání dat:", error);
        alert("Chyba: " + error.message + "\nZkontrolujte konzoli (F12) nebo Firebase Rules.");
    }
};

// --- RENDER OVÁNÍ ---

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mřížka
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    const step = canvas.width / 8; // Každých 50 bloků
    for (let i = 0; i <= canvas.width; i += step) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Osy
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();

    // Měření
    measurements.forEach(m => {
        const cx = toCanvas(m.x);
        const cz = toCanvas(m.z);
        const cr = m.r * (canvas.width / MAP_SIZE);

        // Kružnice (vzdálenost)
        ctx.beginPath();
        ctx.arc(cx, cz, cr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Střed (pozice hráče)
        ctx.beginPath();
        ctx.arc(cx, cz, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
    });

    // --- TRILATERAČNÍ ODHAD (Zvýraznění průsečíků) ---
    drawIntersections();
}

function drawIntersections() {
    if (measurements.length < 2) return;

    const intersections = [];
    for (let i = 0; i < measurements.length; i++) {
        for (let j = i + 1; j < measurements.length; j++) {
            const pts = getCircleIntersections(measurements[i], measurements[j]);
            if (pts) intersections.push(...pts);
        }
    }

    intersections.forEach(p => {
        ctx.beginPath();
        ctx.arc(toCanvas(p.x), toCanvas(p.z), 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.6)'; // Žlutá pro průsečíky
        ctx.fill();
    });
}

// Matematika pro průsečíky dvou kružnic
function getCircleIntersections(c1, c2) {
    const dx = c2.x - c1.x;
    const dz = c2.z - c1.z;
    const d = Math.sqrt(dx * dx + dz * dz);

    if (d > c1.r + c2.r || d < Math.abs(c1.r - c2.r) || d === 0) return null;

    const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h = Math.sqrt(c1.r * c1.r - a * a);
    const x2 = c1.x + a * dx / d;
    const z2 = c1.z + a * dz / d;

    const rx = -dz * (h / d);
    const rz = dx * (h / d);

    return [
        { x: x2 + rx, z: z2 + rz },
        { x: x2 - rx, z: z2 - rz }
    ];
}

// --- INICIALIZACE ---

window.addEventListener('resize', resizeCanvas);
updateDateDisplay();
resizeCanvas();
loadData();

// Každou minutu zkontrolovat datum (pro midnight reset bez refreshe)
setInterval(() => {
    const current = dateSpan.textContent;
    const now = getCurrentDateStr();
    if (current !== now) {
        updateDateDisplay();
        loadData();
    }
}, 60000);
