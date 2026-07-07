const fs = require("fs");
const path = require("path");

// Simple helper to load environment variables from .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Error: .env.local file not found.");
    process.exit(1);
  }
  
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      
      process.env[key] = value;
    }
  });
}

loadEnv();

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Error: Firebase Admin credentials not found in .env.local");
  process.exit(1);
}

const serviceAccount = {
  projectId,
  clientEmail,
  privateKey: privateKey.replace(/\\n/g, "\n"),
};

const adminApp = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(adminApp);

// Realistic dummy yard log data
const SAMPLE_LOGS = [
  { gp_no: "GP26070301201", truck_no: "GJ12BZ7739", vessel_name: "MV LONG MEI", commodity: "STEAM COAL", receiver_party: "LOTUS RESOURCES INDIA PVT LTD", yard_location: "T25-1", boe_no: "9694861", surveyor_name: "John Surveyor" },
  { gp_no: "GP26070301202", truck_no: "GJ12CZ8812", vessel_name: "MV LONG MEI", commodity: "STEAM COAL", receiver_party: "LOTUS RESOURCES INDIA PVT LTD", yard_location: "T25-1", boe_no: "9694861", surveyor_name: "John Surveyor" },
  { gp_no: "GP26070301203", truck_no: "GJ12DZ9921", vessel_name: "MV LONG MEI", commodity: "STEAM COAL", receiver_party: "ADANI ENTERPRISES LTD", yard_location: "T25-2", boe_no: "9694862", surveyor_name: "Vikram Mehta" },
  { gp_no: "GP26070301204", truck_no: "MH43TY5567", vessel_name: "MV SAFINA", commodity: "GYPSUM", receiver_party: "ACC CEMENTS LTD", yard_location: "Y12-A", boe_no: "9712534", surveyor_name: "Vikram Mehta" },
  { gp_no: "GP26070301205", truck_no: "GJ01BX2212", vessel_name: "MV SAFINA", commodity: "GYPSUM", receiver_party: "ACC CEMENTS LTD", yard_location: "Y12-A", boe_no: "9712534", surveyor_name: "Rajesh Kumar" },
  { gp_no: "GP26070301206", truck_no: "GJ03FF9918", vessel_name: "MV PACIFIC BULKER", commodity: "IRON ORE", receiver_party: "JINDAL STEEL COAL", yard_location: "T09-D", boe_no: "9812456", surveyor_name: "Rajesh Kumar" },
  { gp_no: "GP26070301207", truck_no: "GJ12AZ4422", vessel_name: "MV PACIFIC BULKER", commodity: "IRON ORE", receiver_party: "JINDAL STEEL COAL", yard_location: "T09-D", boe_no: "9812456", surveyor_name: "Vikram Mehta" },
  { gp_no: "GP26070301208", truck_no: "GJ12EZ1198", vessel_name: "MV PACIFIC BULKER", commodity: "IRON ORE", receiver_party: "ADANI POWER LTD", yard_location: "T09-E", boe_no: "9812457", surveyor_name: "John Surveyor" },
  { gp_no: "GP26070301209", truck_no: "MH12RR8872", vessel_name: "MV BLUE OCEAN", commodity: "STEAM COAL", receiver_party: "TATA POWER LTD", yard_location: "T25-1", boe_no: "9912001", surveyor_name: "Rajesh Kumar" },
  { gp_no: "GP26070301210", truck_no: "GJ12KZ5512", vessel_name: "MV BLUE OCEAN", commodity: "STEAM COAL", receiver_party: "TATA POWER LTD", yard_location: "T25-1", boe_no: "9912001", surveyor_name: "John Surveyor" },
  { gp_no: "GP26070301211", truck_no: "GJ09HH1122", vessel_name: "MV SHANDONG", commodity: "BENTONITE", receiver_party: "ASHAPURA CLAYS", yard_location: "Y15-B", boe_no: "9923481", surveyor_name: "Rajesh Kumar" },
  { gp_no: "GP26070301212", truck_no: "GJ12UZ6639", vessel_name: "MV SHANDONG", commodity: "BENTONITE", receiver_party: "ASHAPURA CLAYS", yard_location: "Y15-B", boe_no: "9923481", surveyor_name: "Vikram Mehta" },
  { gp_no: "GP26070301213", truck_no: "GJ12MZ9924", vessel_name: "MV SHANDONG", commodity: "BENTONITE", receiver_party: "ASHAPURA CLAYS", yard_location: "Y15-C", boe_no: "9923482", surveyor_name: "John Surveyor" },
  { gp_no: "GP26070301214", truck_no: "GJ12BZ7744", vessel_name: "MV LONG MEI", commodity: "STEAM COAL", receiver_party: "LOTUS RESOURCES INDIA PVT LTD", yard_location: "T25-1", boe_no: "9694861", surveyor_name: "John Surveyor" },
  { gp_no: "GP26070301215", truck_no: "MH43TY5599", vessel_name: "MV SAFINA", commodity: "GYPSUM", receiver_party: "ACC CEMENTS LTD", yard_location: "Y12-A", boe_no: "9712534", surveyor_name: "Vikram Mehta" },
];

async function seed() {
  try {
    console.log("Seeding realistic sample logs into Firestore database...");
    
    for (let i = 0; i < SAMPLE_LOGS.length; i++) {
      const log = SAMPLE_LOGS[i];
      
      // Calculate realistic rolling timestamps over the last 24 hours
      const timestamp = new Date(Date.now() - (SAMPLE_LOGS.length - i) * 20 * 60 * 1000).toISOString();
      const payload = {
        ...log,
        timestamp,
        createdAt: timestamp,
      };

      console.log(`Uploading Log ${i + 1}/${SAMPLE_LOGS.length}: GP ${log.gp_no}`);
      await db.collection("yard_logs").doc(log.gp_no).set(payload);
    }

    console.log("Database seeding completed successfully! Dashboard analytics is now populated.");
    process.exit(0);
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exit(1);
  }
}

seed();
