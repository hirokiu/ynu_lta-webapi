import { randomBytes, scrypt, timingSafeEqual, createHash } from 'crypto';
export function username(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(value)) throw new Error('Invalid username');
    return value;
}
export function validPassword(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('hex');
const derive = (password: string, salt: string): Promise<Buffer> => new Promise((resolve, reject) => {
    scrypt(password, salt, 64, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024}, (error, key) => error ? reject(error) : resolve(key));
});
export async function passwordHash(password: string): Promise<string> {
    if (!validPassword(password)) throw new Error('Invalid password');
    const salt = randomBytes(16).toString('hex');
    return `scrypt1:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function passwordMatches(password: string, hash: string): Promise<boolean> {
    const match = /^scrypt1:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash);
    const key = await derive(password, match ? match[1] : '00000000000000000000000000000000');
    return !!match && timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}
