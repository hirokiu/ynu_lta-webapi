import { ADMIN_USERNAMES } from '../constants/surveyApi.constants';
export function resolveIdentity(token: {uid?: string; email?: string}, env = process.env) {
    if (env.AUTH_MODE === 'uid') {
        const identities = JSON.parse(env.AUTH_IDENTITY_MAP || '{}');
        if (!token.uid || !Object.prototype.hasOwnProperty.call(identities, token.uid)) throw new Error('Account is not provisioned');
        const identity = identities[token.uid];
        if (!identity || typeof identity.userId !== 'string' || !identity.userId.trim()) throw new Error('Invalid identity');
        return {userId: identity.userId, isAdmin: identity.isAdmin === true};
    }
    if (env.AUTH_MODE && env.AUTH_MODE !== 'legacy') throw new Error('Invalid authentication mode');
    if (!token.email) throw new Error('Missing legacy identity');
    const userId = token.email.replace('@humlablu.com', '');
    return {userId, isAdmin: ADMIN_USERNAMES.includes(userId)};
}
