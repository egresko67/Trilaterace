const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, push } = require("firebase/database");
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyCoMnZyBg6IV6H_NPuX40c2dbrChCkYPCs",
  authDomain: "trilaterace.firebaseapp.com",
  databaseURL: "https://trilaterace-default-rtdb.europe-west1.firebasedatabase.app", 
  projectId: "trilaterace",
  storageBucket: "trilaterace.firebasestorage.app",
  messagingSenderId: "542609606032",
  appId: "1:542609606032:web:b9fa594544d7e429f15f15"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const poolData = JSON.parse(fs.readFileSync('pool_locations.json', 'utf8'));

async function uploadPool() {
    console.log(`Nahrávám ${poolData.length} lokací do plochého poolu...`);
    
    for (const loc of poolData) {
        const newRef = push(ref(db, 'confirmed_eggs'));
        await set(newRef, {
            ...loc,
            timestamp: Date.now()
        });
        console.log(`Nahráno: [${loc.x}, ${loc.y}, ${loc.z}]`);
    }
    
    console.log("Hotovo!");
    process.exit(0);
}

uploadPool().catch(err => {
    console.error(err);
    process.exit(1);
});
