import {Assignment, AssignmentResults} from '../models/survey.model';
import {ExportError} from './exportFile';

// Read both historical storage formats without modifying research data.
export async function surveyAnswerSources(sid: string, range?: any, selectedIds?: string[]) {
    const assignments: any[] = await Assignment.find({'survey._id': sid}).select('_id').limit(50001).lean().maxTimeMS(15000).exec();
    if (assignments.length > 50000) throw new ExportError(413, 'Too many assignments for one export');
    const ids = assignments.map(a => a._id);
    const answered = {'dataset.answers.0': {$exists: true}};
    const modern: any = {...answered, assignment: {$in: ids}};
    const legacy: any = {...answered, _id: {$in: ids}};
    if (range) {
        modern.$or = legacy.$or = [{lastOpenedAt: range}, {lastOpenedAt: null, updatedAt: range}];
    }
    if (selectedIds) {
        modern._id = {$in: selectedIds.filter(id => !id.startsWith('legacy:'))};
        legacy._id = {$in: ids.filter(id => selectedIds.includes('legacy:' + String(id)))};
    }
    const legacyPipeline: any[] = [{$match: legacy}, {$lookup: {
        from: AssignmentResults.collection.name, let: {aid: '$_id', uid: '$userId'},
        pipeline: [{$match: {...answered, $expr: {$and: [{$eq: ['$assignment', '$$aid']}, {$eq: ['$userId', '$$uid']}]}}}, {$limit: 1}, {$project: {_id: 1}}], as: 'newerAnswer'
    }}, {$match: {'newerAnswer.0': {$exists: false}}}];
    return {modern, legacyPipeline};
}
export async function combinedAnswerCursor(sid: string, range?: any, selectedIds?: string[]) {
    const {modern, legacyPipeline} = await surveyAnswerSources(sid, range, selectedIds);
    const cursors: any[] = [
        AssignmentResults.find(modern).select('userId dataset lastOpenedAt updatedAt').lean().maxTimeMS(60000).cursor({batchSize: 1}),
        Assignment.aggregate([...legacyPipeline, {$project: {userId: 1, dataset: 1, lastOpenedAt: 1, updatedAt: 1}}]).option({maxTimeMS: 60000}).cursor({batchSize: 1}).exec()
    ];
    let index = 0;
    return {async next() {while (index < cursors.length) {const row = await cursors[index].next(); if (row) return row; index++;} return null;},
        async close() {await Promise.all(cursors.map(c => c.close()));}};
}
export async function surveyAnswerPage(sid: string, skip: number, limit: number) {
    const {modern, legacyPipeline} = await surveyAnswerSources(sid);
    const modernCount = await AssignmentResults.countDocuments(modern).maxTimeMS(15000).exec();
    const legacyCount = await Assignment.aggregate([...legacyPipeline, {$count: 'count'}]).option({maxTimeMS: 15000}).exec();
    const cursors: any[] = [
        AssignmentResults.find(modern).select('userId lastOpenedAt updatedAt dataset.answers.index')
            .sort({updatedAt: -1, _id: -1}).lean().maxTimeMS(15000).cursor({batchSize: 50}),
        Assignment.aggregate([...legacyPipeline, {$sort: {updatedAt: -1, _id: -1}},
            {$project: {userId: 1, lastOpenedAt: 1, updatedAt: 1, 'dataset.answers.index': 1}}])
            .option({maxTimeMS: 15000}).cursor({batchSize: 50}).exec()
    ];
    const items: any[] = [];
    try {
        const heads = await Promise.all(cursors.map(c => c.next()));
        for (let offset = 0; offset < skip + limit && heads.some(Boolean); offset++) {
            // Merge sorted cursors so historical storage does not put recent answers on later pages.
            const left = heads[0], right = heads[1];
            const timeDifference = left && right ? new Date(left.updatedAt || 0).getTime() - new Date(right.updatedAt || 0).getTime() : 0;
            const index = !left ? 1 : !right ? 0 : timeDifference > 0 ||
                (timeDifference === 0 && String(left._id) >= String(right._id)) ? 0 : 1;
            const row = heads[index];
            if (offset >= skip) items.push({_id: (index ? 'legacy:' : '') + String(row._id), userId: row.userId,
                answeredAt: row.lastOpenedAt || row.updatedAt, answerCount: row.dataset.answers.length, source: index ? 'legacy' : 'results'});
            heads[index] = await cursors[index].next();
        }
    } finally { await Promise.all(cursors.map(c => c.close())); }
    return {total: modernCount + (legacyCount[0] ? legacyCount[0].count : 0), items};
}
