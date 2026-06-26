import { ADMIN_PASSWORD } from 'astro:env/server';

export function getEnv(name) {
    if (name === 'ADMIN_PASSWORD' && ADMIN_PASSWORD) return ADMIN_PASSWORD;

    const metaValue = import.meta.env?.[name];
    if (metaValue) return metaValue;

    if (typeof process !== 'undefined') {
        return process.env?.[name];
    }

    return undefined;
}

export function getAdminPassword() {
    return getEnv('ADMIN_PASSWORD');
}

export function isAdminKey(key) {
    const adminPassword = getAdminPassword();
    return Boolean(adminPassword) && key === adminPassword;
}

export function isAdminSession(cookies) {
    const adminPassword = getAdminPassword();
    return Boolean(adminPassword) && cookies.get('adminSession')?.value === adminPassword;
}

export function unauthorizedJson() {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
    });
}
