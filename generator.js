const fs = require('fs');

function generateData() {
    const targets = [];
    for (let i = 0; i < 10; i++) {
        targets.push({
            id: i,
            x: Math.round(Math.random() * 400 - 200),
            y: Math.round(Math.random() * 300 - 64), // Minecraft výška
            z: Math.round(Math.random() * 400 - 200)
        });
    }

    const measurements = {};
    let mId = 0;

    targets.forEach(t => {
        // Každý cíl bude mít 4 měření (celkem 40)
        for (let i = 0; i < 4; i++) {
            const pX = t.x + (Math.random() * 100 - 50);
            const pY = t.y + (Math.random() * 100 - 50);
            const pZ = t.z + (Math.random() * 100 - 50);
            
            const dist = Math.sqrt(
                Math.pow(pX - t.x, 2) + 
                Math.pow(pY - t.y, 2) + 
                Math.pow(pZ - t.z, 2)
            );

            measurements[`m${mId++}`] = {
                x: Math.round(pX * 10) / 10,
                y: Math.round(pY * 10) / 10,
                z: Math.round(pZ * 10) / 10,
                r: Math.round(dist * 10) / 10,
                timestamp: Date.now()
            };
        }
    });

    fs.writeFileSync('measurements.json', JSON.stringify(measurements, null, 2));
    fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
    console.log(`✅ Úspěch: Vygenerováno ${targets.length} cílů a ${Object.keys(measurements).length} měření.`);
}

generateData();
