/** Explicit, operator-only migration. Never run automatically on deployment. */
import mongoose from 'mongoose';
import { writeFileSync } from 'fs';
import https from 'https';
import admin from '../services/firebaseAdmin.service';
import { Account, accountScope, accountsEnabled } from './models';
import { secret, digest } from './credentials';
import { User } from '../models/survey.model';

async function removeLegacyCredential(uid: string, removeEmail: boolean) {
    const project = process.env.FIREBASE_PROJECT_ID!;
    const access = await admin.app().options.credential.getAccessToken();
    const body = JSON.stringify({localId: uid, deleteProvider: ['password'],
        ...(removeEmail ? {deleteAttribute: ['EMAIL']} : {}), returnSecureToken: false});
    await new Promise<void>((resolve, reject) => {
        const request = https.request(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:update`, {
            method: 'POST', headers: {Authorization: 'Bearer ' + access.access_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}
        }, response => {
            response.resume(); response.on('end', () => response.statusCode === 200 ? resolve() : reject(new Error('Firebase credential removal failed')));
        });
        request.setTimeout(15000, () => request.destroy(new Error('Firebase timeout')));
        request.on('error', reject); request.end(body);
    });
}
async function main() {
    const [operation = 'inspect', name, output] = process.argv.slice(2);
    if (!['hanzawa', 'hasegawa'].includes(name) || !['inspect', 'prepare', 'finalize'].includes(operation)) throw new Error('Only named researcher migrations are permitted');
    if (!accountsEnabled()) throw new Error('Username accounts must be enabled with AUTH_MODE=uid');
    const identities = JSON.parse(process.env.AUTH_IDENTITY_MAP || '{}');
    const matches = Object.keys(identities).filter(uid => identities[uid].userId === name && identities[uid].isAdmin === true);
    if (matches.length !== 1) throw new Error('Exactly one existing administrator UID is required');
    const uid = matches[0];
    await mongoose.connect(process.env.MONGO_URL!, {useNewUrlParser: true, useUnifiedTopology: true, autoIndex: false});
    await Account.createIndexes();
    if (!await User.exists({userId: name})) throw new Error('Existing user data not found');
    const firebaseUser = await admin.auth().getUser(uid);
    if (firebaseUser.disabled) throw new Error('Existing account disabled');
    const account: any = await Account.findOne({uid}).select('+passwordHash').lean().exec();
    if (operation === 'inspect') {
        console.log(JSON.stringify({username: name, dataFound: true, prepared: !!account, active: account && account.state === 'active',
            legacyEmailPresent: firebaseUser.email === name + '@humlablu.com', passwordProvider: firebaseUser.providerData.some((p: any) => p.providerId === 'password')}));
        return;
    }
    if (operation === 'prepare') {
        if (!output || account || firebaseUser.email !== name + '@humlablu.com') throw new Error('A new output file and unchanged legacy account are required');
        const invitation = secret();
        // Save privately before database insertion; wx refuses to overwrite any existing file.
        writeFileSync(output, JSON.stringify({username: name, invitation}) + '\n', {mode: 0o600, flag: 'wx'});
        await Account.create({scope: accountScope(), username: name, uid, userId: name, state: 'invited', migration: true,
            invitationHash: digest(invitation), invitationExpiresAt: new Date(Date.now() + 7 * 86400000), createdBy: 'operator-migration'});
        console.log('Prepared; existing credentials and all survey data remain unchanged.');
        return;
    }
    if (!account || !account.migration || account.userId !== name || account.state !== 'active' || !account.passwordHash || !account.lastUsernameLoginAt)
        throw new Error('New password login must be verified before finalization');
    await removeLegacyCredential(uid, firebaseUser.email === name + '@humlablu.com');
    await admin.auth().revokeRefreshTokens(uid);
    const after = await admin.auth().getUser(uid);
    if (after.email === name + '@humlablu.com' || after.providerData.some((p: any) => p.providerId === 'password' || p.email === name + '@humlablu.com'))
        throw new Error('Legacy credential still present; inspect before retrying');
    console.log('Legacy credential removed for named researcher only; UID and data IDs preserved.');
}
main().then(() => mongoose.disconnect()).catch(async error => {
    console.error(error.message); await mongoose.disconnect(); process.exitCode = 1;
});
