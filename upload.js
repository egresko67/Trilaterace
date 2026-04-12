const fs = require('fs');

async function uploadToFirebase() {
    try {
        const measurements = JSON.parse(fs.readFileSync('measurements.json', 'utf8'));
        const dateStr = new Date().toISOString().split('T')[0];
        const dbUrl = `https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app/measurements/${dateStr}.json`;

        console.log(`Zkouším PATCH ${Object.keys(measurements).length} měření...`);

        const response = await fetch(dbUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(measurements)
        });

        if (response.ok) {
            console.log('✅ Data na Firebase úspěšně nahrána.');
        } else {
            const err = await response.text();
            console.log('❌ Chyba při nahrávání:', response.status, err);
        }
    } catch (error) {
        console.error('❌ Kritická chyba:', error.message);
    }
}

uploadToFirebase();
