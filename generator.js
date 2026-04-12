const fs = require('fs');

function generateData() {
    // 10 cílů (EGGs) rozprostřených po Minecraft světě
    const targets = [
        { id: 0, x: -10,  y: 70,  z: -50 },
        { id: 1, x: 150,  y: 65,  z: 120 },
        { id: 2, x: 120,  y: -20, z: -130 },
        { id: 3, x: -160, y: 110, z: 40 },
        { id: 4, x: 80,   y: 10,  z: 10 },
        { id: 5, x: -40,  y: 40,  z: 160 },
        { id: 6, x: 180,  y: 90,  z: -80 },
        { id: 7, x: -120, y: 30,  z: -170 },
        { id: 8, x: 10,   y: 120, z: 90 },
        { id: 9, x: 60,   y: -40, z: -30 }
    ];

    const measurements = {};
    let mId = 0;

    targets.forEach(t => {
        // Pro každý cíl vygenerujeme 5 měření z různých pozic
        for (let i = 0; i < 5; i++) {
            const pX = t.x + (Math.random() * 200 - 100);
            const pY = t.y + (Math.random() * 50 - 25);
            const pZ = t.z + (Math.random() * 200 - 100);
            
            const dist = Math.sqrt(
                Math.pow(pX - t.x, 2) + 
                Math.pow(pY - t.y, 2) + 
                Math.pow(pZ - t.z, 2)
            );

            // Striktní struktura pro Firebase: x, z, r musí být čísla
            // Přidáme i y a timestamp, protože .validate kontroluje existenci x,z,r, ale nezakazuje ostatní
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
    console.log("Vygenerováno 10 cílů a 50 měření do measurements.json");
}

generateData();
