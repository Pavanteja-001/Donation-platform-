import { initializeApp, cert, getApps, applicationDefault, App } from "firebase-admin/app";
import { getMessaging as getFcmMessaging, Messaging } from "firebase-admin/messaging";
import path from "path";
import fs from "fs";

let firebaseApp: App | null = null;

export function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0]!;
    return firebaseApp;
  }

  // 1. Try environment variable FIREBASE_SERVICE_ACCOUNT_JSON (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[firebase] Initialized Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT_JSON env.");
      return firebaseApp;
    } catch (err) {
      console.error("[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env:", err);
    }
  }

  // 2. Try local service account file in backend directory
  const possiblePaths = [
    path.join(__dirname, "../../FIREBASE_SERVICE_ACCOUNT.json"),
    path.join(__dirname, "../../firebase-service-account.json"),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf8"));
        firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });
        console.log(`[firebase] Initialized Firebase Admin SDK from ${path.basename(filePath)}`);
        return firebaseApp;
      } catch (err) {
        console.error(`[firebase] Failed to load service account from ${filePath}:`, err);
      }
    }
  }

  // 3. Fallback: Default application credentials
  try {
    firebaseApp = initializeApp({
      credential: applicationDefault(),
    });
    console.log("[firebase] Initialized Firebase Admin SDK from application default credentials.");
    return firebaseApp;
  } catch (err) {
    console.error("[firebase] Could not initialize Firebase Admin SDK. Push notifications will fail until credentials are provided.", err);
    throw err;
  }
}

export function getMessaging(): Messaging {
  return getFcmMessaging(getFirebaseApp());
}
