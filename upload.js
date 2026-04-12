const fs = require('fs');

async function uploadToFirebase() {
    try {
        const measurements = JSON.parse(fs.readFileSync('measurements.json', 'utf8'));
        const dateStr = new Date().toISOString().split('T')[0];
        
        console.log(`Nahrávám ${Object.keys(measurements).length} měření po jednom...`);

        for (const [id, m] of Object.entries(measurements)) {
            const dbUrl = `https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app/measurements/${dateStr}/${id}.json`;
            const response = await fetch(dbUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(m)
            });
            if (!response.ok) {
                console.error(`❌ Chyba u ${id}:`, response.status);
            }
        }
        console.log('✅ Hotovo.');
    } catch (error) {
        console.error('❌ Kritická chyba:', error.message);
    }
}

uploadToFirebase();
