/** Environment-level capability registry. Disabling enrollment never disables identity resolution. */
import { accountsEnabled } from './models';
function flag(name: string) { return process.env[name] === undefined || process.env[name] === 'true'; }
export function accountFeatures() {
    const enabled = accountsEnabled();
    return {
        usernameLogin: enabled,
        invitations: enabled && flag('ACCOUNT_INVITATIONS_ENABLED'),
        passwordReset: enabled && flag('ACCOUNT_PASSWORD_RESET_ENABLED'),
        googleRegistration: enabled && flag('ACCOUNT_INVITATIONS_ENABLED') && flag('ACCOUNT_GOOGLE_REGISTRATION_ENABLED')
    };
}
export type AccountFeature = 'invitations' | 'passwordReset' | 'googleRegistration';
