import { Application, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import admin from '../services/firebaseAdmin.service';
import { User } from '../models/survey.model';
import { checkIfAuthenticatedAdmin } from '../services/surveyApi.service';
import { Account, AuthThrottle, accountsEnabled, accountScope } from './models';
import { username, validPassword, passwordHash, passwordMatches, digest, secret } from './credentials';

export function accountRoutes(app: Application) {
    let ready: Promise<any> | undefined;
    const prepare = () => ready || (ready = Promise.all([Account.createIndexes(), AuthThrottle.createIndexes()]).catch(error => { ready = undefined; throw error; }));
    app.get('/api/auth/options', (_req, res) => res.set('Cache-Control', 'no-store').json({usernameLogin: accountsEnabled()}));
    const limited = async (key: string, maximum: number) => {
        const bucket = Math.floor(Date.now() / 600000);
        const count: any = await AuthThrottle.findOneAndUpdate({_id: digest(key) + ':' + bucket},
            {$inc: {count: 1}, $setOnInsert: {expiresAt: new Date((bucket + 2) * 600000)}}, {upsert: true, new: true}).lean().exec();
        return count.count <= maximum;
    };
    const wrap = (handler: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
        res.set('Cache-Control', 'no-store');
        if (!accountsEnabled()) return res.status(404).json({error: 'この機能は現在利用できません。'});
        try { accountScope(); await prepare(); await handler(req, res); }
        catch (_) { if (!res.headersSent) res.status(503).json({error: '処理できませんでした。時間をおいて再試行してください。'}); }
    };
    const publicLimit = async (req: Request, res: Response, key: string) => {
        if (!await limited('ip:' + req.ip, 100) || !await limited('account:' + key, 10)) {
            res.set('Retry-After', '600').status(429).json({error: '試行回数が多いため、10分後に再試行してください。'}); return false;
        }
        return true;
    };
    app.post('/api/admin/account-invitations', wrap(async (req, res) => {
        checkIfAuthenticatedAdmin(req, res, async actor => {
            try {
                let name: string;
                try { name = username(req.body && req.body.username); }
                catch (_) { return res.status(400).json({error: 'ユーザー名は半角小文字・数字・_・-の3〜32文字で指定してください。'}); }
                // Never bind an invitation to an existing user's data or Firebase UID.
                const identities = JSON.parse(process.env.AUTH_IDENTITY_MAP || '{}');
                const reserved = Object.keys(identities).some(uid => identities[uid].userId === name);
                if (reserved || await User.exists({userId: name})) return res.status(409).json({error: 'このユーザー名は既存アカウントで使用されています。'});
                // Reserve pre-existing Firebase-only users too; this never creates a domain-based account.
                try {
                    await admin.auth().getUserByEmail(name + '@humlablu.com');
                    return res.status(409).json({error: 'このユーザー名は既存アカウントで使用されています。'});
                } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
                const invitation = secret();
                const id = 'u_' + randomBytes(16).toString('hex');
                const expiresAt = new Date(Date.now() + 7 * 86400000);
                await Account.create({scope: accountScope(), username: name, uid: id, userId: id, state: 'invited',
                    invitationHash: digest(invitation), invitationExpiresAt: expiresAt, createdBy: actor});
                res.status(201).json({username: name, invitation, expiresAt});
            } catch (e) {
                res.status(e.code === 11000 ? 409 : 503).json({error: '招待を作成できませんでした。ユーザー名の重複などを確認してください。'});
            }
        });
    }));
    // Rotate both the link and Firebase identity: a previous pending Google session
    // must never become the next recipient's active identity. Existing migrations
    // are deliberately excluded because their UID must be preserved.
    app.post('/api/admin/account-invitations/:name/:action', wrap(async (req, res) => {
        checkIfAuthenticatedAdmin(req, res, async actor => {
            try {
                let name: string;
                try { name = username(req.params.name); } catch (_) { return res.sendStatus(400); }
                const action = req.params.action;
                if (action !== 'reissue' && action !== 'cancel') return res.sendStatus(400);
                const filter = {scope: accountScope(), username: name, state: 'invited', migration: {$ne: true}};
                const previous: any = await Account.findOne(filter).lean().exec();
                if (!previous) return res.status(409).json({error: '未登録の新規招待のみ変更できます。既存アカウントの移行は対象外です。'});
                const invitation = secret();
                const id = 'u_' + randomBytes(16).toString('hex');
                const expiresAt = new Date(Date.now() + 7 * 86400000);
                const update = action === 'reissue'
                    ? {$set: {uid: id, userId: id, invitationHash: digest(invitation), invitationExpiresAt: expiresAt, createdBy: actor}}
                    : {$set: {state: 'disabled'}, $unset: {invitationHash: '', invitationExpiresAt: ''}};
                const changed = await Account.findOneAndUpdate({...filter, uid: previous.uid, updatedAt: previous.updatedAt}, update, {new: true}).exec();
                if (!changed) return res.status(409).json({error: '招待の状態が変わりました。再確認してください。'});
                // An old Firebase UID has no active data identity, even if a concurrent
                // bootstrap finishes later. Do not delete remote users during this operation.
                if (action === 'cancel') return res.json({cancelled: true});
                res.json({username: name, invitation, expiresAt});
            } catch (_) { if (!res.headersSent) res.status(503).json({error: '招待を変更できませんでした。'}); }
        });
    }));
    // A pending Firebase session can only configure its own provider; the data API still denies it.
    app.post('/api/auth/invitation-google-session', wrap(async (req, res) => {
        const invitation = req.body && req.body.invitation;
        if (typeof invitation !== 'string' || !/^[a-f0-9]{64}$/.test(invitation)) return res.sendStatus(400);
        if (!await publicLimit(req, res, digest(invitation))) return;
        const account: any = await Account.findOne({scope: accountScope(), state: 'invited', invitationHash: digest(invitation),
            invitationExpiresAt: {$gt: new Date()}}).lean().exec();
        if (!account) return res.status(400).json({error: '招待が無効、期限切れ、または使用済みです。'});
        // Existing administrator migrations must first set a new password. Do not issue their UID on this endpoint.
        if (account.migration) return res.status(409).json({error: '既存アカウントの移行では、先にパスワードを設定してください。その後Googleを追加できます。'});
        try { await admin.auth().createUser({uid: account.uid}); }
        catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
        res.json({customToken: await admin.auth().createCustomToken(account.uid)});
    }));
    app.post('/api/auth/activate-google', wrap(async (req, res) => {
        const invitation = req.body && req.body.invitation;
        if (typeof invitation !== 'string' || !/^[a-f0-9]{64}$/.test(invitation)) return res.sendStatus(400);
        if (!await publicLimit(req, res, digest(invitation))) return;
        let token: any;
        try { token = await admin.auth().verifyIdToken(req.header('token'), true); }
        catch (_) { return res.sendStatus(401); }
        const filter = {scope: accountScope(), uid: token.uid, migration: {$ne: true}, state: 'invited',
            invitationHash: digest(invitation), invitationExpiresAt: {$gt: new Date()}};
        const account: any = await Account.findOne(filter).lean().exec();
        if (!account) return res.status(400).json({error: '招待を確認できませんでした。'});
        const user = await admin.auth().getUser(account.uid);
        if (user.disabled || !user.providerData.some((p: any) => p.providerId === 'google.com'))
            return res.status(400).json({error: 'Googleとの連携を先に完了してください。'});
        await User.updateOne({userId: account.userId}, {$setOnInsert: {userId: account.userId, timezone: 'Asia/Tokyo'}}, {upsert: true}).exec();
        const updated = await Account.findOneAndUpdate(filter, {$set: {state: 'active'},
            $unset: {invitationHash: '', invitationExpiresAt: ''}}, {new: true}).exec();
        if (!updated) return res.status(409).json({error: 'この招待はすでに使用されています。'});
        res.json({username: account.username});
    }));
    app.post('/api/auth/activate', wrap(async (req, res) => {
        const invitation = req.body && req.body.invitation;
        const password = req.body && req.body.password;
        if (typeof invitation !== 'string' || !/^[a-f0-9]{64}$/.test(invitation) || !validPassword(password))
            return res.status(400).json({error: '招待情報と12〜128文字のパスワードを確認してください。'});
        if (!await publicLimit(req, res, digest(invitation))) return;
        const filter = {scope: accountScope(), state: 'invited', invitationHash: digest(invitation), invitationExpiresAt: {$gt: new Date()}};
        const account: any = await Account.findOne(filter).lean().exec();
        if (!account) return res.status(400).json({error: '招待が無効、期限切れ、または使用済みです。'});
        const hash = await passwordHash(password);
        try { await admin.auth().createUser({uid: account.uid}); }
        catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
        const token = await admin.auth().createCustomToken(account.uid);
        // Prepare an empty participant record only. No existing user or answer is changed.
        if (account.migration) {
            if (!await User.exists({userId: account.userId})) throw new Error('Existing user data missing');
        } else {
            await User.updateOne({userId: account.userId}, {$setOnInsert: {userId: account.userId, timezone: 'Asia/Tokyo'}}, {upsert: true}).exec();
        }
        const updated = await Account.findOneAndUpdate(filter, {$set: {state: 'active', passwordHash: hash},
            $unset: {invitationHash: '', invitationExpiresAt: ''}}, {new: true}).exec();
        if (!updated) return res.status(409).json({error: 'この招待はすでに使用されています。ログインしてください。'});
        res.json({customToken: token, username: account.username});
    }));
    app.post('/api/auth/username-login', wrap(async (req, res) => {
        let name: string;
        try { name = username(req.body && req.body.username); }
        catch (_) { return res.status(401).json({error: 'ユーザー名またはパスワードが正しくありません。'}); }
        const password = req.body && req.body.password;
        if (!validPassword(password)) return res.status(401).json({error: 'ユーザー名またはパスワードが正しくありません。'});
        if (!await publicLimit(req, res, name)) return;
        const account: any = await Account.findOne({scope: accountScope(), username: name, state: 'active'}).select('+passwordHash').lean().exec();
        const matches = await passwordMatches(password, account ? account.passwordHash || '' : '');
        if (!account || !matches) return res.status(401).json({error: 'ユーザー名またはパスワードが正しくありません。'});
        const firebaseUser = await admin.auth().getUser(account.uid);
        if (firebaseUser.disabled) return res.status(401).json({error: 'ログインできません。管理者へお問い合わせください。'});
        const customToken = await admin.auth().createCustomToken(account.uid);
        await Account.updateOne({_id: account._id, state: 'active'}, {$set: {lastUsernameLoginAt: new Date()}}).exec();
        res.json({customToken});
    }));
}
