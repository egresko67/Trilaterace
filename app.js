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

let measurements = [];
let intersections = [];
let confirmedEggs = [];
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
    // Umožnit zoom out na 0.5 (vidět až do +/- 400)
    const newZoom = Math.min(Math.max(viewState.zoom * factor, 0.5), 15);
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
        // Oprava výpočtu souřadnic pod kurzorem při zoomu/panu
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
    viewport.setAttribute('transform', `translate(${viewState.x}, ${viewState.y}) scale(${viewState.zoom})`);
    renderGrid(); // Překreslit mřížku při pohybu
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
    if (conf >= 4) return '#22c55e'; // Pro 4 vzorky na cíl je 4+ "vynikající"
    if (conf >= 3) return '#fbbf24';
    if (conf >= 2) return '#f97316';
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
    onValue(ref(db, `measurements/${dateStr}`), (snap) => {
        const data = snap.val();
        measurements = data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
        processAll();
    });
    onValue(ref(db, `confirmed_eggs/${dateStr}`), (snap) => {
        const data = snap.val();
        confirmedEggs = data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
        processAll();
    });
}

function processAll() {
    calculateIntersections();
    updateUI();
    renderSVG();
}

function calculateIntersections() {
    let currentMeasurements = [...measurements];
    let foundTargets = [];
    
    // 1. Odstranit potvrzená vejce
    confirmedEggs.forEach(egg => {
        currentMeasurements = currentMeasurements.filter(m => {
            const d = Math.sqrt(Math.pow(egg.x-m.x,2)+Math.pow(egg.y-m.y,2)+Math.pow(egg.z-m.z,2));
            return Math.abs(d - m.r) > 5;
        });
    });

    // 2. Najít zbytek
    const MAX_TARGETS = 10 - confirmedEggs.length;
    for (let t = 0; t < MAX_TARGETS; t++) {
        if (currentMeasurements.length < 3) break;
        let candidates = [];
        
        for (let i = 0; i < currentMeasurements.length; i++) {
            for (let j = i + 1; j < currentMeasurements.length; j++) {
                for (let k = j + 1; k < currentMeasurements.length; k++) {
                    const pts = getSphereIntersections(currentMeasurements[i], currentMeasurements[j], currentMeasurements[k]);
                    if (pts) {
                        pts.forEach(p => {
                            // PŘÍSNÝ FILTR: Pouze body uvnitř herní oblasti
                            if (p.x >= -200 && p.x <= 200 && p.z >= -200 && p.z <= 200 && p.y >= -64 && p.y <= 320) {
                                let matchingPoints = [];
                                // KRITICKÁ OPRAVA: Počítat jistotu pouze z AKTUÁLNÍCH zbývajících měření
                                currentMeasurements.forEach(m => {
                                    const d = Math.sqrt(Math.pow(p.x-m.x,2)+Math.pow(p.y-m.y,2)+Math.pow(p.z-m.z,2));
                                    if (Math.abs(d - m.r) < 5) matchingPoints.push(m);
                                });
                                
                                if (matchingPoints.length >= 2) { // Sníženo na 2 pro zobrazení i slabších shluků
                                    let totalDist = 0; let count = 0;
                                    for(let a=0; a<matchingPoints.length; a++) {
                                        for(let b=a+1; b<matchingPoints.length; b++) {
                                            totalDist += Math.sqrt(Math.pow(matchingPoints[a].x-matchingPoints[b].x,2) + Math.pow(matchingPoints[a].z-matchingPoints[b].z,2));
                                            count++;
                                        }
                                    }
                                    candidates.push({...p, support: matchingPoints.length, quality: count > 0 ? (totalDist / count) : 0});
                                }
                            }
                        });
                    }
                }
            }
        }
        
        if (candidates.length === 0) break;
        candidates.sort((a, b) => (b.support * 1000 + b.quality) - (a.support * 1000 + a.quality));
        const best = candidates[0];
        
        foundTargets.push({ 
            x: Math.round(best.x), y: Math.round(best.y), z: Math.round(best.z), 
            confidence: best.support, 
            quality: Math.min(100, Math.round(best.quality / 2)) 
        });
        
        // Odstranit spotřebovaná měření
        currentMeasurements = currentMeasurements.filter(m => {
            const d = Math.sqrt(Math.pow(best.x-m.x,2)+Math.pow(best.y-m.y,2)+Math.pow(best.z-m.z,2));
            return Math.abs(d - m.r) > 5;
        });
    }
    intersections = foundTargets;
}

function updateUI() {
    countSpan.textContent = measurements.length;
    tableBody.innerHTML = '';
    measurements.sort((a,b)=>b.timestamp-a.timestamp).forEach(m => {
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
        tr.innerHTML = `<td><span class="mono clickable" onclick="focusOnPoint(${p.x},${p.z})">${p.x} / ${p.y} / ${p.z}</span><div style="font-size: 0.6rem; color: #94a3b8">Kvalita: ${p.quality}%</div></td><td><span class="badge" style="color:${color}">${p.confidence}</span></td><td><button class="btn-primary" style="padding:4px 8px; font-size:0.7rem" onclick="confirmEgg(${p.x},${p.y},${p.z})">Ok</button></td>`;
        targetsTableBody.appendChild(tr);
    });
    confirmedTableBody.innerHTML = '';
    confirmedEggs.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><span class="mono clickable" onclick="focusOnPoint(${e.x},${e.z})">${Math.round(e.x)} / ${Math.round(e.y)} / ${Math.round(e.z)}</span></td><td><button class="btn-del-small" onclick="deleteEgg('${e.id}')">✕</button></td>`;
        confirmedTableBody.appendChild(tr);
    });
}

function renderGrid() {
    layers.grid.innerHTML = '';
    const step = 50;
    // Vykreslit mřížku v širším rozsahu pro zoom-out
    for (let i = -400; i <= 800; i += step) {
        const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vLine.setAttribute("x1", i); vLine.setAttribute("y1", -400); vLine.setAttribute("x2", i); vLine.setAttribute("y2", 800);
        vLine.setAttribute("class", i === 200 ? "svg-axis-line" : "svg-grid-line");
        layers.grid.appendChild(vLine);
        const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hLine.setAttribute("x1", -400); hLine.setAttribute("y1", i); hLine.setAttribute("x2", 800); hLine.setAttribute("y2", i);
        hLine.setAttribute("class", i === 200 ? "svg-axis-line" : "svg-grid-line");
        layers.grid.appendChild(hLine);
    }
}

function renderSVG() {
    renderGrid();
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
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", toCoord(p.x)); c.setAttribute("cy", toCoord(p.z));
        c.setAttribute("r", 6); c.setAttribute("class", "svg-poi-point");
        c.style.fill = getConfidenceColor(p.confidence);
        c.onmouseenter = (e) => showTooltip(e, p);
        c.onmouseleave = hideTooltip;
        layers.intersections.appendChild(c);
    });
    confirmedEggs.forEach(e => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", toCoord(e.x)); c.setAttribute("cy", toCoord(e.z));
        c.setAttribute("r", 10);
        c.style.fill = "#fbbf24"; c.style.stroke = "#fff"; c.style.strokeWidth = "2";
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", toCoord(e.x)-5); text.setAttribute("y", toCoord(e.z)+4);
        text.setAttribute("font-size", "10"); text.textContent = "🥚";
        g.appendChild(c); g.appendChild(text);
        layers.intersections.appendChild(g);
    });
}

// --- GLOBÁLNÍ FUNKCE ---
window.deleteMeasurement = (id) => remove(ref(db, `measurements/${getCurrentDateStr()}/${id}`));
window.deleteAllMeasurements = async () => { if(confirm("Opravdu smazat všechna měření pro dnešek?")) await remove(ref(db, `measurements/${getCurrentDateStr()}`)); };
window.deleteEgg = (id) => remove(ref(db, `confirmed_eggs/${getCurrentDateStr()}/${id}`));
window.confirmEgg = async (x, y, z) => { const dateStr = getCurrentDateStr(); await push(ref(db, `confirmed_eggs/${dateStr}`), { x: Math.round(x), y: Math.round(y), z: Math.round(z), timestamp: Date.now() }); };
window.addManualEgg = async () => { const x = document.getElementById('conf-x').value; const y = document.getElementById('conf-y').value; const z = document.getElementById('conf-z').value; if (x && y && z) { await window.confirmEgg(x, y, z); document.getElementById('conf-x').value = ''; document.getElementById('conf-y').value = ''; document.getElementById('conf-z').value = ''; } };

function getSphereIntersections(p1, p2, p3) {
    const P1={x:p1.x,y:p1.y||0,z:p1.z}, P2={x:p2.x,y:p2.y||0,z:p2.z}, P3={x:p3.x,y:p3.y||0,z:p3.z}, r1=p1.r, r2=p2.r, r3=p3.r;
    const sub=(v1,v2)=>({x:v1.x-v2.x,y:v1.y-v2.y,z:v1.z-v2.z}), dot=(v1,v2)=>v1.x*v2.x+v1.y*v2.y+v1.z*v2.z, mag=(v)=>Math.sqrt(dot(v,v)), div=(v,s)=>({x:v.x/s,y:v.y/s,z:v.z/s}), mul=(v,s)=>({x:v.x*s,y:v.y*s,z:v.z*s}), add=(v1,v2)=>({x:v1.x+v2.x,y:v1.y+v2.y,z:v1.z+v2.z}), cross=(v1,v2)=>({x:v1.y*v2.z-v1.z*v2.y,y:v1.z*v2.x-v1.x*v2.z,z:v1.x*v2.y-v1.y*v2.x});
    const d_vec=sub(P2,P1); const d=mag(d_vec); if(d<0.1) return null;
    const ex=div(d_vec,d); const p3p1=sub(P3,P1); const i=dot(ex,p3p1); const ey_vec=sub(p3p1,mul(ex,i)); const j=mag(ey_vec); if(j<0.5) return null;
    const ey=div(ey_vec,j); const ez=cross(ex,ey); const x=(r1*r1-r2*r2+d*d)/(2*d); const y=(r1*r1-r3*r3+i*i+j*j)/(2*j)-(i/j)*x;
    const zSq=r1*r1-x*x-y*y; if(zSq<-100) return null; const z=Math.sqrt(Math.max(0,zSq)); const base=add(P1,add(mul(ex,x),mul(ey,y))); return [add(base,mul(ez,z)),sub(base,mul(ez,z))];
}

function showTooltip(e, p) { hoverInfo.style.display = 'block'; hoverInfo.innerHTML = `<strong>Odhad</strong><br>X: ${p.x}<br>Y: ${p.y}<br>Z: ${p.z}<br><small>Kvalita: ${p.quality}%</small>`; moveTooltip(e); }
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
window.focusOnPoint = (x, z) => { 
    viewState.zoom = 2; 
    viewState.x = 200 - (x+OFFSET)*2; 
    viewState.y = 200 - (z+OFFSET)*2; 
    updateViewTransformation(); 
};

form.onsubmit = async (e) => { e.preventDefault(); const dateStr = getCurrentDateStr(); await push(ref(db, `measurements/${dateStr}`), { x: parseFloat(xInput.value), y: parseFloat(yInput.value), z: parseFloat(zInput.value), r: parseFloat(rInput.value), timestamp: Date.now() }); form.reset(); };

loadData();
setInterval(loadData, 60000);
