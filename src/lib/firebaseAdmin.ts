import "server-only";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

let db: any;
let auth: any;

if (projectId && clientEmail && privateKey) {
  const serviceAccount = {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };

  const adminApp = !getApps().length
    ? initializeApp({
        credential: cert(serviceAccount),
      })
    : getApp();

  db = getFirestore(adminApp);
  auth = getAuth(adminApp);
} else {
  console.warn(
    "⚠️ Firebase Admin Environment Variables are missing! Using mock Firestore and Auth instances for build verification."
  );
  
  // Export a mock db object so the build doesn't crash during static page collection (CWE-703 / Fail Safe)
  db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => ({}) }),
        set: async () => {},
        delete: async () => {},
      }),
      orderBy: () => ({
        limit: () => ({
          get: async () => {
            const mockSnapshot: any = [];
            return mockSnapshot;
          },
        }),
      }),
    }),
  } as any;

  // Export a mock auth object for build verification
  auth = {
    createUser: async (properties: any) => ({ uid: "mock-uid-123", ...properties }),
    setCustomUserClaims: async (uid: string, claims: any) => {},
    getUserByEmail: async (email: string) => ({ uid: "mock-uid-123", email }),
  } as any;
}

export const adminDb = db;
export const adminAuth = auth;
