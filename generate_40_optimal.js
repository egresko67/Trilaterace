const fs = require('fs');

function generateOptimalDataset() {
    // Cílový bod (např. dračí vejce)
    const target = { x: 120, y: 45, z: -80 };
    const measurements = {};
    const count = 40;
    const baseTimestamp = 1776019786000;

    for (let i = 0; i < count; i++) {
        // Generujeme body v různých směrech od cíle pro optimální trilateraci
        // Použijeme sférické souřadnice pro rovnoměrné rozdělení
        const phi = Math.acos(-1 + (2 * i) / count); // Sklon
        const theta = Math.sqrt(count * Math.PI) * phi; // Azimut

        const dist = 80 + Math.random() * 120; // Vzdálenost 80-200 bloků

        const pX = target.x + dist * Math.sin(phi) * Math.cos(theta);
        const pY = target.y + dist * Math.cos(phi);
        const pZ = target.z + dist * Math.sin(phi) * Math.sin(theta);

        // Skutečná vzdálenost k cíli
        const r = Math.sqrt(
            Math.pow(pX - target.x, 2) +
            Math.pow(pY - target.y, 2) +
            Math.pow(pZ - target.z, 2)
        );

        const id = `opt_${baseTimestamp + i}`;
        measurements[id] = {
            x: Math.round(pX),
            y: Math.round(pY),
            z: Math.round(pZ),
            r: parseFloat(r.toFixed(1)), // 1 desetinné místo pro přesnost
            timestamp: baseTimestamp + i
        };
    }

    const output = {
        target_reference: target,
        measurements: measurements
    };

    fs.writeFileSync('optimal-dataset.json', JSON.stringify(output, null, 2));
    console.log(`✅ Vygenerováno 40 optimálních vzorků do optimal-dataset.json`);
    console.log(`📍 Cíl pro testování: [${target.x}, ${target.y}, ${target.z}]`);
}

generateOptimalDataset();
