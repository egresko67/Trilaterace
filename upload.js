const fs = require('fs');

const TARGET_COUNT = 3; 
const MEASUREMENT_COUNT = 20;
const RANGE_MIN = -200;
const RANGE_MAX = 200;
const Y_MIN = -64;
const Y_MAX = 320;

const DB_URL = "https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app";
const dateStr = new Date().toISOString().split('T')[0];

function getRandomCoord(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateDistance3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 1. Generování cílů
const targets = {};
for (let i = 0; i < TARGET_COUNT; i++) {
    const id = "target_" + i;
    targets[id] = {
        x: getRandomCoord(RANGE_MIN, RANGE_MAX),
        y: getRandomCoord(Y_MIN, Y_MAX),
        z: getRandomCoord(RANGE_MIN, RANGE_MAX)
    };
}

// 2. Generování měření
const measurements = {};
const now = Date.now();
const targetKeys = Object.keys(targets);
for (let i = 0; i < MEASUREMENT_COUNT; i++) {
    const p = {
        x: getRandomCoord(RANGE_MIN, RANGE_MAX),
        y: getRandomCoord(Y_MIN, Y_MAX),
        z: getRandomCoord(RANGE_MIN, RANGE_MAX)
    };
    let minR = Infinity;
    targetKeys.forEach(k => {
        const d = calculateDistance3D(p, targets[k]);
        if (d < minR) minR = d;
    });

    measurements["test_" + (now + i)] = {
        x: p.x,
        y: p.y,
        z: p.z,
        r: Math.round(minR * 10) / 10,
        timestamp: now + i
    };
}

// 3. Uložení do lokálních souborů
fs.writeFileSync('measurements.json', JSON.stringify(measurements, null, 2), 'utf8');
fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2), 'utf8');

console.log("✅ Soubory vytvořeny:");
console.log("   - measurements.json (Data pro aplikaci)");
console.log("   - targets.json (Skutečné polohy pro kontrolu)");

// 4. Odeslání do Firebase
async function upload() {
    console.log(`\nOdesílám data do Firebase...`);
    try {
        await fetch(`${DB_URL}/measurements/${dateStr}.json`, {
            method: 'PATCH',
            body: JSON.stringify(measurements),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("✅ Data na Firebase aktualizována.");
    } catch (err) {
        console.error("❌ Chyba při nahrávání na Firebase:", err.message);
    }
}

upload();
