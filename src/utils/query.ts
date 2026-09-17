// Shared validation keeps malformed filters from silently exporting all data.
export function pageOptions(query: any) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid page or limit");
    return { page, limit, skip: (page - 1) * limit };
}
export function literalSearch(value: any) {
    if (value === undefined || value === "") return undefined;
    if (typeof value !== "string" || value.length > 100) throw new Error("Invalid search");
    return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
export function dateRange(from: any, to: any) {
    if (from === undefined && to === undefined) return undefined;
    if (typeof from !== "string" || typeof to !== "string") throw new Error("Both dates are required");
    const start = new Date(from), end = new Date(to);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new Error("Invalid date range");
    return { $gte: start, $lte: end };
}

export function exportOptions(input: any, explicitScope: boolean) {
    if (explicitScope && !['all', 'period', 'selected'].includes(input.scope)) throw new Error('Invalid export scope');
    const range = dateRange(input.from, input.to);
    let selectedIds: string[] | undefined;
    if (explicitScope) {
        if (input.scope === 'period' && !range) throw new Error('Dates required');
        if (input.scope !== 'period' && range) throw new Error('Unexpected dates');
        if (input.scope === 'selected') {
            if (!Array.isArray(input.ids) || input.ids.length < 1 || input.ids.length > 1000 ||
                input.ids.some((id: any) => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))) throw new Error('Invalid selection');
            selectedIds = Array.from(new Set<string>(input.ids));
        } else if (input.ids !== undefined) throw new Error('Unexpected selection');
    }
    return { range, selectedIds };
}
