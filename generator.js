const fs = require('fs');

/**
 * Generátor testovacích dat pro Trilaterace-Therapie (3D verze)
 */

const TARGET_COUNT = 10;
const MEASUREMENT_COUNT = 30;
const RANGE_MIN = -200;
const RANGE_MAX = 200;
const Y_MIN = -64;
const Y_MAX = 320;

function getRandomCoord(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateDistance3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 1. Vygenerování 10 cílových bodů (vajec)
const targets = [];
for (let i = 0; i < TARGET_COUNT; i++) {
    targets.push({
        x: getRandomCoord(RANGE_MIN, RANGE_MAX),
        y: getRandomCoord(Y_MIN, Y_MAX),
        z: getRandomCoord(RANGE_MIN, RANGE_MAX)
    });
}

const isJsonOnly = process.argv.includes('--json');
const isFileExport = process.argv.includes('--file');

if (!isJsonOnly && !isFileExport) {
    console.log("--- CÍLOVÉ BODY (Skutečné polohy) ---");
    targets.forEach((t, i) => console.log(`Cíl ${i+1}: [${t.x}, ${t.y}, ${t.z}]`));
}

// 2. Vygenerování měření
const measurements = [];
for (let i = 0; i < MEASUREMENT_COUNT; i++) {
    const playerPos = {
        x: getRandomCoord(RANGE_MIN, RANGE_MAX),
        y: getRandomCoord(Y_MIN, Y_MAX),
        z: getRandomCoord(RANGE_MIN, RANGE_MAX)
    };

    let minDistance = Infinity;
    targets.forEach(target => {
        const dist = calculateDistance3D(playerPos, target);
        if (dist < minDistance) minDistance = dist;
    });

    measurements.push({
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        r: Math.round(minDistance * 10) / 10
    });
}

// JSON výstup
const firebaseOutput = {};
const now = Date.now();
measurements.forEach((m, i) => {
    // Použijeme klíče bez prefixu 'm', aby Firebase Console neprostestoval, 
    // a uložíme jako čisté objekty.
    firebaseOutput["test_" + (now + i)] = {
        x: m.x,
        y: m.y,
        z: m.z,
        r: m.r,
        timestamp: now + i
    };
});

if (isFileExport) {
    fs.writeFileSync('test-data.json', JSON.stringify(firebaseOutput, null, 2), 'utf8');
    console.log("Hotovo! Soubor test-data.json (UTF-8) byl vytvořen.");
} else if (isJsonOnly) {
    console.log(JSON.stringify(firebaseOutput, null, 2));
} else {
    console.log("\n--- JSON STRUKTURA PRO FIREBASE ---");
    console.log(JSON.stringify(firebaseOutput, null, 2));
}
