var admin = require("firebase-admin");
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is required");
const serviceAccount = JSON.parse(require("fs").readFileSync(credentialPath, "utf8"));
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || serviceAccount.project_id !== projectId) throw new Error("Firebase service account project mismatch");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
    ...(process.env.FIREBASE_DATABASE_URL ? { databaseURL: process.env.FIREBASE_DATABASE_URL } : {})
});
export default admin;
