import { Account, accountsEnabled } from './models';
import { resolveIdentity } from '../utils/identity';
export async function resolveAccountIdentity(token: {uid?: string; email?: string}) {
    if (accountsEnabled() && token.uid) {
        const account: any = await Account.findOne({uid: token.uid}).lean().exec();
        if (account) {
            if (account.state === 'invited' && account.migration) return resolveIdentity(token);
            if (account.state !== 'active') throw new Error('Account is not active');
            // Preserve privileges only through the existing explicit UID map, never a username.
            if (account.migration) {
                const legacy = resolveIdentity(token);
                if (legacy.userId !== account.userId) throw new Error('Identity mismatch');
                return legacy;
            }
            // New invitations only provision participants.
            return {userId: account.userId as string, isAdmin: false};
        }
    }
    return resolveIdentity(token);
}
