const fs = require('fs');

function generateData() {
    const dateStr = new Date().toISOString().split('T')[0];
    const targets = [];
    const measurements = {};
    let mId = 0;

    while (targets.length < 10) {
        const candidate = {
            id: targets.length,
            x: Math.round(Math.random() * 240 - 120),
            y: Math.round(Math.random() * 80 - 20),
            z: Math.round(Math.random() * 240 - 120)
        };
        if (!targets.some(t => Math.sqrt(Math.pow(t.x-candidate.x,2)+Math.pow(t.z-candidate.z,2)) < 140)) {
            targets.push(candidate);
        }
    }

    targets.forEach(target => {
        for (let j = 0; j < 5; j++) {
            const phi = Math.acos(-1 + (2 * j) / 4);
            const theta = 2 * Math.PI * 0.618033 * j;
            const dist = 140 + Math.random() * 60;
            const pX = Math.round(target.x + dist * Math.sin(phi) * Math.cos(theta));
            const pY = Math.round(target.y + dist * Math.cos(phi));
            const pZ = Math.round(target.z + dist * Math.sin(phi) * Math.sin(theta));
            const r = Math.sqrt(Math.pow(pX-target.x,2)+Math.pow(pY-target.y,2)+Math.pow(pZ-target.z,2));

            measurements[`m_${Date.now()}_${mId++}`] = {
                x: pX, y: pY, z: pZ, r: parseFloat(r.toFixed(1)),
                timestamp: Date.now() + mId
            };
        }
    });

    fs.writeFileSync('bulk_measurements.json', JSON.stringify(measurements, null, 2));
    fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
    console.log(`✅ Data vygenerována do bulk_measurements.json.`);
}

generateData();
