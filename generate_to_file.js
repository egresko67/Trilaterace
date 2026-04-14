const fs = require('fs');

function run() {
    const targets = [];
    const measurements = {};
    while(targets.length < 10) {
        const c = { id: targets.length, x: Math.round(Math.random()*240-120), y: Math.round(Math.random()*100-20), z: Math.round(Math.random()*240-120) };
        if(!targets.some(t => Math.sqrt(Math.pow(t.x-c.x,2)+Math.pow(t.z-c.z,2)) < 160)) targets.push(c);
    }

    targets.forEach((t, i) => {
        for(let j=0; j<5; j++) {
            const phi = Math.acos(-1 + (2*j)/4);
            const theta = 2*Math.PI*0.618033*j;
            const dist = 160 + Math.random()*40;
            const pX = Math.round(t.x + dist*Math.sin(phi)*Math.cos(theta));
            const pY = Math.round(t.y + dist*Math.cos(phi));
            const pZ = Math.round(t.z + dist*Math.sin(phi) * Math.sin(theta));
            const r = Math.sqrt(Math.pow(pX-t.x,2)+Math.pow(pY-t.y,2)+Math.pow(pZ-t.z,2));
            measurements[`m_${i}_${j}`] = { x: pX, y: pY, z: pZ, r: parseFloat(r.toFixed(1)), timestamp: Date.now() };
        }
    });

    fs.writeFileSync('measurements.json', JSON.stringify(measurements, null, 2));
    fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
    console.log(`✅ Vygenerováno 10 cílů a 50 měření do measurements.json.`);
}

run();
