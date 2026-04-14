const fs = require('fs');

function generateData() {
    const targets = [];
    const measurements = {};
    let mId = 0;
    const targetsCount = 10;
    const measurementsPerTarget = 5;

    while (targets.length < targetsCount) {
        const candidate = {
            id: targets.length,
            x: Math.round(Math.random() * 300 - 150),
            y: Math.round(Math.random() * 150 - 30),
            z: Math.round(Math.random() * 300 - 150)
        };

        const isTooClose = targets.some(t => 
            Math.sqrt(Math.pow(t.x - candidate.x, 2) + Math.pow(t.z - candidate.z, 2)) < 80
        );

        if (!isTooClose) {
            targets.push(candidate);
        }
    }

    targets.forEach(target => {
        for (let j = 0; j < measurementsPerTarget; j++) {
            // Použijeme Fibonacciho sféru pro maximální rozptyl bodů
            const phi = Math.acos(-1 + (2 * j) / (measurementsPerTarget - 1 || 1));
            const theta = 2 * Math.PI * 0.618033 * j;
            
            const dist = 100 + Math.random() * 50; // Větší vzdálenost (100-150)

            const pX = Math.round(target.x + dist * Math.sin(phi) * Math.cos(theta));
            const pY = Math.round(target.y + dist * Math.cos(phi));
            const pZ = Math.round(target.z + dist * Math.sin(phi) * Math.sin(theta));

            const r = Math.sqrt(
                Math.pow(pX - target.x, 2) +
                Math.pow(pY - target.y, 2) +
                Math.pow(pZ - target.z, 2)
            );

            measurements[`m${mId++}`] = {
                x: pX,
                y: pY,
                z: pZ,
                r: parseFloat(r.toFixed(1)),
                timestamp: Date.now() + mId
            };
        }
    });

    fs.writeFileSync('measurements.json', JSON.stringify(measurements, null, 2));
    fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
    console.log(`✅ Úspěch: Vygenerováno 10 unikátních cílů (rozestup 80) a 50 měření s vysokým rozptylem.`);
}

generateData();
