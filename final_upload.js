const fs = require('fs');
const https = require('https');

function upload(url, data, method = 'PUT') {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 10000
        }, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => resolve(resData));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

async function run() {
    const dateStr = new Date().toISOString().split('T')[0];
    const baseUrl = `https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app`;

    try {
        console.log("🧹 Čistím potvrzená vejce...");
        await upload(`${baseUrl}/confirmed_eggs/${dateStr}.json`, null, 'DELETE');

        console.log("🧬 Generuji 10 cílů...");
        const targets = [];
        const measurements = {};
        while(targets.length < 10) {
            const c = { id: targets.length, x: Math.round(Math.random()*240-120), y: Math.round(Math.random()*80-20), z: Math.round(Math.random()*240-120) };
            if(!targets.some(t => Math.sqrt(Math.pow(t.x-c.x,2)+Math.pow(t.z-c.z,2)) < 150)) targets.push(c);
        }

        targets.forEach((t, i) => {
            for(let j=0; j<5; j++) {
                const phi = Math.acos(-1 + (2*j)/4);
                const theta = 2*Math.PI*0.618033*j;
                const dist = 150 + Math.random()*50;
                const pX = Math.round(t.x + dist*Math.sin(phi)*Math.cos(theta));
                const pY = Math.round(t.y + dist*Math.cos(phi));
                const pZ = Math.round(t.z + dist*Math.sin(phi)*Math.sin(theta));
                const r = Math.sqrt(Math.pow(pX-t.x,2)+Math.pow(pY-t.y,2)+Math.pow(pZ-t.z,2));
                measurements[`m_${i}_${j}`] = { x: pX, y: pY, z: pZ, r: parseFloat(r.toFixed(1)), timestamp: Date.now() };
            }
        });

        console.log("🚀 Nahrávám hromadně všechna měření najednou...");
        await upload(`${baseUrl}/measurements/${dateStr}.json`, measurements, 'PUT');

        fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
        console.log("✅ HOTOVO. 10 cílů nahráno.");
    } catch (e) {
        console.error("❌ CHYBA:", e.message);
    }
}

run();
