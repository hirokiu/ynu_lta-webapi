import mongoose from 'mongoose';
const account = new mongoose.Schema({
    scope: {type: String, required: true}, username: {type: String, required: true},
    uid: {type: String, required: true}, userId: {type: String, required: true},
    state: {type: String, enum: ['invited', 'active', 'disabled'], required: true},
    passwordHash: {type: String, select: false}, invitationHash: {type: String, select: false},
    invitationExpiresAt: Date, createdBy: String, migration: Boolean, lastUsernameLoginAt: Date
}, {timestamps: true});
account.index({scope: 1, username: 1}, {unique: true});
account.index({uid: 1}, {unique: true});
account.index({userId: 1}, {unique: true});
export const Account = mongoose.model('LoginAccount', account);
const throttle = new mongoose.Schema({_id: String, count: Number, expiresAt: Date});
throttle.index({expiresAt: 1}, {expireAfterSeconds: 0});
export const AuthThrottle = mongoose.model('AuthThrottle', throttle);
export function accountsEnabled() { return process.env.USERNAME_ACCOUNTS_ENABLED === 'true' && process.env.AUTH_MODE === 'uid'; }
export function accountScope() {
    const scope = process.env.ACCOUNT_SCOPE;
    if (!scope || !/^[a-z0-9_-]{1,40}$/.test(scope)) throw new Error('ACCOUNT_SCOPE is required');
    return scope;
}
