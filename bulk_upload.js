const fs = require('fs');

async function bulkUpload() {
    const dateStr = new Date().toISOString().split('T')[0];
    const baseUrl = "https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app";

    try {
        console.log(`🧹 Čistím a hromadně nahrávám pro den ${dateStr}...`);
        
        // Smazání potvrzených vajec pro dnešek
        await fetch(`${baseUrl}/confirmed_eggs/${dateStr}.json`, { method: 'DELETE' });

        const targets = [];
        const measurements = {};
        let mId = 0;

        while (targets.length < 10) {
            const candidate = {
                id: targets.length,
                x: Math.round(Math.random() * 260 - 130),
                y: Math.round(Math.random() * 120 - 40),
                z: Math.round(Math.random() * 260 - 130)
            };
            if (!targets.some(t => Math.sqrt(Math.pow(t.x-candidate.x,2)+Math.pow(t.z-candidate.z,2)) < 130)) {
                targets.push(candidate);
            }
        }

        targets.forEach(target => {
            for (let j = 0; j < 5; j++) {
                const phi = Math.acos(-1 + (2 * j) / 4);
                const theta = 2 * Math.PI * 0.618033 * j;
                const dist = 130 + Math.random() * 50;
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

        // Hromadné nahrání všech měření najednou (přepíše dnešní den)
        const response = await fetch(`${baseUrl}/measurements/${dateStr}.json`, {
            method: 'PUT',
            body: JSON.stringify(measurements)
        });

        if (!response.ok) throw new Error(`Chyba při nahrávání: ${response.status}`);

        fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
        console.log(`✅ Úspěch: Databáze vyčištěna a nahráno 10 cílů hromadně.`);
    } catch (e) {
        console.error("❌ Kritická chyba:", e.message);
    }
}

bulkUpload();
