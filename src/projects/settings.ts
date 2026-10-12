import mongoose from 'mongoose';
import { Application } from 'express';
import { accountScope } from '../accounts/models';
import { checkIfAuthenticatedAdmin, getAuthenticatedUserId } from '../services/surveyApi.service';

const moment = require('moment-timezone');
export function validateTimezone(value: any): string {
    if (typeof value !== 'string' || !moment.tz.zone(value)) throw new Error('Invalid timezone');
    return value;
}
const schema = new mongoose.Schema({
    _id: String, displayName: String, subtitle: String, timezone: String, revision: {type: Number, default: 0},
    history: [{_id: false, actor: String, at: Date, before: String, after: String, timezoneBefore: String, timezoneAfter: String, subtitleBefore: String, subtitleAfter: String}]
}, {timestamps: true});
export const ProjectSettings = mongoose.model('ProjectSettings', schema);
export function validateName(value: any): string {
    if (typeof value !== 'string') throw new Error('Invalid name');
    const name = value.trim();
    if (!name || Array.from(name).length > 80 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name)) throw new Error('Invalid name');
    return name;
}
export function validateSubtitle(value: any): string {
    if (typeof value !== 'string') throw new Error('Invalid subtitle');
    const subtitle = value.trim();
    if (Array.from(subtitle).length > 120 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(subtitle)) throw new Error('Invalid subtitle');
    return subtitle;
}
export async function currentProject() {
    const projectId = accountScope();
    const row: any = await ProjectSettings.findById(projectId).lean().exec();
    return {projectId, subtitle: row && typeof row.subtitle === "string" ? row.subtitle : null, displayName: row ? row.displayName : (projectId === 'dev' ? 'Dev' : 'Proto'), revision: row ? row.revision : 0, timezone: row && row.timezone || 'Asia/Tokyo'};
}
export function projectRoutes(app: Application) {
    app.get('/api/project', (req, res) => {
        res.set('Cache-Control', 'no-store');
        getAuthenticatedUserId(req, res, async () => {
            try { res.json(await currentProject()); }
            catch (_) { res.status(503).json({error: 'プロジェクト名を取得できませんでした。'}); }
        });
    });
    app.put('/api/admin/project', (req, res) => {
        res.set('Cache-Control', 'no-store');
        checkIfAuthenticatedAdmin(req, res, async actor => {
            let displayName: string;
            let subtitle: string | undefined;
            let timezone: string | undefined;
            const revision = req.body && req.body.revision;
            try {
                displayName = validateName(req.body && req.body.displayName);
                if (req.body.subtitle !== undefined) subtitle = validateSubtitle(req.body.subtitle);
                if (req.body.timezone !== undefined) timezone = validateTimezone(req.body.timezone);
                if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision');
                if (Object.keys(req.body).some(key => !['displayName', 'revision', 'timezone', 'subtitle'].includes(key))) throw new Error('Unknown field');
            } catch (_) { return res.status(400).json({error: '名称は1〜80文字の1行で入力してください。サブタイトルは120文字以内の1行で入力し、有効なタイムゾーンを選択してください。'}); }
            try {
                const previous = await currentProject();
                if (previous.revision !== revision) return res.status(409).json({error: '他の操作で変更されました。再読み込みして確認してください。'});
                timezone = timezone || previous.timezone;
                const updated: any = await ProjectSettings.findOneAndUpdate({_id: previous.projectId, revision}, {
                    $set: {displayName, timezone, ...(subtitle !== undefined ? {subtitle} : {})}, $inc: {revision: 1},
                    $push: {history: {$each: [{actor, at: new Date(), before: previous.displayName, after: displayName, timezoneBefore: previous.timezone, timezoneAfter: timezone, subtitleBefore: previous.subtitle, subtitleAfter: subtitle === undefined ? previous.subtitle : subtitle}], $slice: -100}}
                }, {new: true, upsert: revision === 0, setDefaultsOnInsert: false}).lean().exec();
                if (!updated) return res.status(409).json({error: '他の操作で変更されました。再読み込みしてください。'});
                res.json({subtitle: updated.subtitle === undefined ? null : updated.subtitle, projectId: previous.projectId, displayName: updated.displayName, revision: updated.revision, timezone: updated.timezone});
            } catch (error) {
                res.status(error.code === 11000 ? 409 : 503).json({error: '名称を保存できませんでした。再読み込みして確認してください。'});
            }
        });
    });
}
