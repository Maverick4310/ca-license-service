export function normalizeName(name) {

    if (!name) {
        return '';
    }

    return name
        .toUpperCase()
        .replace(/\bLLC\b/g, '')
        .replace(/\bINC\b/g, '')
        .replace(/\bCORP\b/g, '')
        .replace(/\bCORPORATION\b/g, '') 
        .replace(/\bLTD\b/g, '')
        .replace(/[^A-Z0-9]/g, '');
}
