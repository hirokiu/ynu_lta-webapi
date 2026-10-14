import admin from "./firebaseAdmin.service";
import { notificationsEnabled } from "../utils/runtimeFlags";

export class CloudMessageService {
    // true means FCM accepted the message, not that the user received/read it.
    public async sendMessage(registrationToken: string, title: string = "KIROKUN",
                             body: string = "KIROKUNからのお知らせです。", data: {[key: string]: string} = {} ): Promise<boolean> {
        if (!notificationsEnabled() || !registrationToken) return false;
        try {
            await admin.messaging().send({
                token: registrationToken,
                notification: {title, body},
                data,
                android: {notification: {sound: "default"}},
                apns: {payload: {aps: {sound: "default"}}}
            });
            return true;
        } catch (_) {
            // Tokens and provider error messages may contain sensitive values.
            console.error("Notification submission failed; left pending for retry.");
            return false;
        }
    }
}
