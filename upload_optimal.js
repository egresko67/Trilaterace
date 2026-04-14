const fs = require('fs');

async function uploadOptimalToFirebase() {
    try {
        const data = JSON.parse(fs.readFileSync('optimal-dataset.json', 'utf8'));
        const measurements = data.measurements;
        const dateStr = new Date().toISOString().split('T')[0];
        
        console.log(`🚀 Nahrávám ${Object.keys(measurements).length} optimálních měření do databáze (${dateStr})...`);

        let successCount = 0;
        for (const [id, m] of Object.entries(measurements)) {
            const dbUrl = `https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app/measurements/${dateStr}/${id}.json`;
            const response = await fetch(dbUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(m)
            });
            
            if (response.ok) {
                successCount++;
            } else {
                console.error(`❌ Chyba u ${id}:`, response.status);
            }
        }
        console.log(`✅ Hotovo. Úspěšně nahráno ${successCount} z ${Object.keys(measurements).length} měření.`);
        console.log(`📍 Cíl pro ověření: [${data.target_reference.x}, ${data.target_reference.y}, ${data.target_reference.z}]`);
    } catch (error) {
        console.error('❌ Kritická chyba:', error.message);
    }
}

uploadOptimalToFirebase();
