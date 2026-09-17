var admin = require("firebase-admin");

// var serviceAccount = require("../constants/ynu-lta-dev-firebase-adminsdk-uidom-dfc2d61445.json");
var serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? JSON.parse(require("fs").readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))
    : require("../constants/ynu-lta-dev-firebase-adminsdk-uidom-bb55db26c5.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ynu-lta-dev-default-rtdb.firebaseio.com/"
})

export default admin;