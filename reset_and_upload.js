const fs = require('fs');

async function clearAndUpload() {
    const dateStr = new Date().toISOString().split('T')[0];
    const baseUrl = "https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app";

    try {
        console.log(`🧹 Čistím data pro den ${dateStr}...`);
        
        // Smazání dnešních měření
        await fetch(`${baseUrl}/measurements/${dateStr}.json`, { method: 'DELETE' });
        // Smazání dnešních potvrzených vajec
        await fetch(`${baseUrl}/confirmed_eggs/${dateStr}.json`, { method: 'DELETE' });

        console.log("🧬 Generuji 10 super-optimálních cílů...");
        const targets = [];
        const measurements = {};
        let mId = 0;

        while (targets.length < 10) {
            const candidate = {
                id: targets.length,
                x: Math.round(Math.random() * 280 - 140),
                y: Math.round(Math.random() * 100 - 20),
                z: Math.round(Math.random() * 280 - 140)
            };

            // Rozestup 120 bloků pro absolutní jistotu
            if (!targets.some(t => Math.sqrt(Math.pow(t.x - candidate.x, 2) + Math.pow(t.z - candidate.z, 2)) < 120)) {
                targets.push(candidate);
            }
        }

        for (const target of targets) {
            for (let j = 0; j < 5; j++) {
                const phi = Math.acos(-1 + (2 * j) / 4);
                const theta = 2 * Math.PI * 0.618033 * j;
                const dist = 120 + Math.random() * 40;

                const pX = Math.round(target.x + dist * Math.sin(phi) * Math.cos(theta));
                const pY = Math.round(target.y + dist * Math.cos(phi));
                const pZ = Math.round(target.z + dist * Math.sin(phi) * Math.sin(theta));

                const r = Math.sqrt(Math.pow(pX-target.x,2)+Math.pow(pY-target.y,2)+Math.pow(pZ-target.z,2));

                measurements[`opt_${Date.now()}_${mId++}`] = {
                    x: pX, y: pY, z: pZ, r: parseFloat(r.toFixed(1)),
                    timestamp: Date.now() + mId
                };
            }
        }

        console.log(`🚀 Nahrávám 50 měření...`);
        for (const [id, m] of Object.entries(measurements)) {
            await fetch(`${baseUrl}/measurements/${dateStr}/${id}.json`, {
                method: 'PUT',
                body: JSON.stringify(m)
            });
        }

        fs.writeFileSync('targets.json', JSON.stringify(targets, null, 2));
        console.log(`✅ Hotovo! Vyčištěno, vygenerováno a nahráno 10 cílů.`);
    } catch (e) {
        console.error("❌ Chyba:", e.message);
    }
}

clearAndUpload();
