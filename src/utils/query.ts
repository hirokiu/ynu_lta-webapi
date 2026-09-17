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
