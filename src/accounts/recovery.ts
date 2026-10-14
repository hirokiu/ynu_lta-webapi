import { accountFeatures } from './features';
/** Operator-only recovery; stop API workers before invoking repair. */
import { writeFileSync } from 'fs';
import mongoose from 'mongoose';
import admin from '../services/firebaseAdmin.service';
import { Account, accountsEnabled, accountScope } from './models';
import { User } from '../models/survey.model';
import { username, secret, digest } from './credentials';

export async function recoverAccount(operation: string, name: string, output?: string, apiStopped = false) {
    if (!accountsEnabled()) throw new Error('Username accounts must be enabled in UID mode');
    username(name);
    const account: any = await Account.findOne({scope: accountScope(), username: name}).lean().exec();
    if (!account || !await User.exists({userId: account.userId})) throw new Error('Account or existing data not found');
    if (account.migration) {
        const identities = JSON.parse(process.env.AUTH_IDENTITY_MAP || '{}');
        const mapped = identities[account.uid];
        if (!['hanzawa', 'hasegawa'].includes(name) || !mapped || !mapped.isAdmin || mapped.userId !== account.userId)
            throw new Error('Researcher identity mapping mismatch');
    }
    const firebaseUser = await admin.auth().getUser(account.uid);
    if (firebaseUser.disabled) throw new Error('Firebase user is disabled');
    if (operation === 'inspect') return {username: name, state: account.state, migration: !!account.migration};
    if (!accountFeatures().passwordReset) throw new Error('Password recovery is disabled');
    if (!output || !['issue', 'repair'].includes(operation)) throw new Error('Use inspect, issue or repair with a private output file');
    if (operation === 'issue' && account.state !== 'active') throw new Error('Only active accounts may receive a reset link');
    if (operation === 'repair' && (account.state !== 'recovering' || !apiStopped))
        throw new Error('Repair requires recovering state and all API workers stopped (--api-stopped)');
    const reset = secret();
    const expiresAt = new Date(Date.now() + 3600000);
    // Refuse existing files; no link or secret is printed. On failure this file
    // may exist without a usable link: inspect state and retry with a new file.
    writeFileSync(output, JSON.stringify({username: name, reset, expiresAt}) + '\n', {mode: 0o600, flag: 'wx'});
    if (operation === 'repair') await admin.auth().revokeRefreshTokens(account.uid);
    const update: any = {$set: {resetHash: digest(reset), resetExpiresAt: expiresAt}};
    if (operation === 'repair') {
        update.$set.state = 'active';
        update.$unset = {passwordHash: ''};
        update.$inc = {credentialVersion: 1};
    }
    const changed = await Account.findOneAndUpdate({_id: account._id, state: account.state, updatedAt: account.updatedAt}, update).exec();
    if (!changed) throw new Error('Account changed concurrently; discard output and inspect');
    return {username: name, resetIssued: true, repaired: operation === 'repair'};
}
if (require.main === module) {
    (async () => {
        const [operation, name, output, flag] = process.argv.slice(2);
        await mongoose.connect(process.env.MONGO_URL!, {useNewUrlParser: true, useUnifiedTopology: true, autoIndex: false});
        console.log(JSON.stringify(await recoverAccount(operation, name, output, flag === '--api-stopped')));
    })().catch(() => { console.error('Recovery failed. Inspect account state and discard any unconfirmed output file.'); process.exitCode = 1; })
        .then(() => mongoose.disconnect());
}
