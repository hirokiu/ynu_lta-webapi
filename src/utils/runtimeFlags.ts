// Preserve the previous scheduler default until explicitly enabled per environment.
export function notificationsEnabled(env = process.env): boolean {
    return env.NOTIFICATIONS_ENABLED !== "false";
}
export function preparationEnabled(env = process.env): boolean {
    return env.ASSIGNMENT_PREPARATION_ENABLED === undefined
        ? notificationsEnabled(env)
        : env.ASSIGNMENT_PREPARATION_ENABLED !== "false";
}
