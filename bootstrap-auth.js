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
const { getAuth } = require("firebase-admin/auth");

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

const adminAuth = getAuth(adminApp);

async function bootstrap() {
  const email = "veer.b.builds@gmail.com";
  const password = process.env.BOOTSTRAP_PASSWORD;
  if (!password) {
    console.error("Error: BOOTSTRAP_PASSWORD environment variable not set in .env.local.");
    process.exit(1);
  }
  
  try {
    console.log(`Checking if user ${email} already exists...`);
    let userRecord;
    
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      console.log(`User ${email} already exists. Updating custom claims...`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.log(`User ${email} not found. Creating new account...`);
        userRecord = await adminAuth.createUser({
          email,
          password,
          emailVerified: true,
        });
        console.log(`Successfully created new user account for ${email} with initial password: ${password}`);
      } else {
        throw err;
      }
    }
    
    // Set developer role claims
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: "superadmin" });
    console.log(`Successfully updated custom claims: { role: 'superadmin' } for user ${email}`);
    console.log("Bootstrap complete. You can now log in using these credentials!");
    process.exit(0);
  } catch (error) {
    console.error("Bootstrap execution failed:", error);
    process.exit(1);
  }
}

bootstrap();
