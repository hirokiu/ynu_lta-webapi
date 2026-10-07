import { Response } from 'express';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const converter = require('json-2-csv');
async function* readRows(path: string) {
    const stream = createReadStream(path, {encoding: 'utf8', highWaterMark: 65536});
    let pending = '';
    try {
        for await (const chunk of stream) {
            pending += chunk;
            let end: number;
            while ((end = pending.indexOf('\n')) >= 0) {
                const line = pending.slice(0, end);
                pending = pending.slice(end + 1);
                yield JSON.parse(line);
            }
        }
    } finally { stream.destroy(); }
}
let busy = false;
export class ExportError extends Error {
    constructor(public status: number, message: string) { super(message); Object.setPrototypeOf(this, ExportError.prototype); }
}
// One export per API process, including slow clients. No waiting queue in RAM.
export async function exportFile(res: Response, source: () => Promise<any>, format: string,
    transform: (records: any[]) => any[], expected?: number) {
    if (busy) { res.setHeader('Retry-After', '10'); res.status(429).json({error: 'Another export is running; retry shortly'}); return; }
    busy = true;
    let dir = '', cursor: any, input: any, output: any;
    const started = Date.now();
    let rows = 0, bytes = 0, cancelled = false;
    const onClose = () => { cancelled = true; };
    res.on('close', onClose);
    const check = () => {
        if (cancelled) throw new ExportError(499, 'Export cancelled');
        if (Date.now() - started > 120000) throw new ExportError(503, 'Export time limit reached; select a shorter period');
    };
    try {
        dir = await fs.mkdtemp(join(tmpdir(), 'kirokun-export-'));
        input = await fs.open(join(dir, 'rows'), 'wx', 0o600);
        cursor = await source();
        const keys = new Set<string>();
        let record: any;
        while ((record = await cursor.next()) != null) {
            check();
            for (const row of transform([record])) {
                Object.keys(row).forEach(k => keys.add(k));
                if (keys.size > 2048) throw new ExportError(413, 'Too many export columns');
                const line = JSON.stringify(row) + '\n';
                bytes += Buffer.byteLength(line);
                if (bytes > 128 * 1024 * 1024) throw new ExportError(413, 'Export exceeds 128 MiB; select a shorter period');
                await input.writeFile(line); rows++;
            }
        }
        await cursor.close(); cursor = null;
        await input.close(); input = null;
        if (expected !== undefined && rows !== expected) throw new ExportError(422, 'Selected answers are no longer available in this Survey');
        const priority = ['回答者ID', '回答時刻', '回答設問数'];
        const sorted = Array.from(keys).sort((a, b) => {
            const ai = priority.indexOf(a), bi = priority.indexOf(b);
            if (ai >= 0 || bi >= 0) return ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
            return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
        });
        const path = join(dir, 'download');
        output = await fs.open(path, 'wx', 0o600);
        let first = true, written = 0;
        const write = async (text: string) => {
            written += Buffer.byteLength(text);
            if (written > 128 * 1024 * 1024) throw new ExportError(413, 'Export exceeds 128 MiB; select a shorter period');
            await output.writeFile(text);
        };
        if (format === 'json') await write('[');
        for await (const row of readRows(join(dir, 'rows'))) {
            check();
            const normalized: any = {};
            sorted.forEach(k => { normalized[k] = row[k] == null ? '' : row[k]; });
            if (format === 'json') await write((first ? '' : ',') + JSON.stringify(normalized));
            else {
                const csv = await new Promise<string>((resolve, reject) => converter.json2csv([normalized],
                    (error: any, value: string) => error ? reject(error) : resolve(value),
                    {unwindArrays: true, prependHeader: first}));
                await write((first ? '' : '\n') + csv);
            }
            first = false;
        }
        if (format === 'json') await write(']');
        await output.close(); output = null;
        check();
        res.type(format === 'csv' ? 'text/csv' : 'application/json');
        await new Promise<void>((resolve, reject) => res.sendFile(path, error => error ? reject(error) : resolve()));
    } catch (error) {
        if (!res.headersSent && !cancelled) res.status(error instanceof ExportError ? error.status : 500).json({error: error instanceof ExportError ? error.message : 'Could not generate export'});
        else if (!cancelled) res.destroy();
    } finally {
        if (cursor) await cursor.close().catch(() => undefined);
        if (input) await input.close().catch(() => undefined);
        if (output) await output.close().catch(() => undefined);
        if (dir) {
            for (const file of ['rows', 'download']) await fs.unlink(join(dir, file)).catch(() => undefined);
            await fs.rmdir(dir).catch(() => undefined);
        }
        res.removeListener('close', onClose);
        busy = false;
        console.info(JSON.stringify({event: 'export_finished', rows, bytes, durationMs: Date.now() - started, rss: process.memoryUsage().rss}));
    }
}
