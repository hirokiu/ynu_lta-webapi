// Fail closed for incomplete schedules. Existing records are not repaired here.
export function answerWindowError(record: any, now: number): string | null {
    const start = record && record.publishAt instanceof Date ? record.publishAt.getTime() : NaN;
    const end = record && record.expireAt instanceof Date ? record.expireAt.getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'Invalid assignment schedule';
    if (now < start) return 'Assignment is not open yet';
    if (now >= end) return 'Assignment has expired';
    return null;
}
// Mongo evaluates the clock at the write, avoiding a read/write boundary race.
export function answerWriteGuard(): any {
    return {
        'dataset.answers.0': {$exists: false},
        publishAt: {$type: 'date'}, expireAt: {$type: 'date'},
        $expr: {$and: [{$lte: ['$publishAt', '$$NOW']}, {$gt: ['$expireAt', '$$NOW']}]}
    };
}
