export async function searchDFPI(companyName) {
    if (!companyName) {
        return [];
    }

    if (!process.env.SERPAPI_KEY) {
        throw new Error('SERPAPI_KEY is not configured.');
    }

    const query = `site:dfpi.ca.gov "${companyName}"`;

    const url =
        `https://serpapi.com/search.json?engine=google` +
        `&q=${encodeURIComponent(query)}` +
        `&api_key=${process.env.SERPAPI_KEY}`;

    const response = await fetch(url, {
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        throw new Error(`SerpAPI failed with status ${response.status}`);
    }

    const data = await response.json();

    return (data.organic_results || [])
        .map(result => {
            const text = `${result.title || ''} ${result.snippet || ''}`;
            const source = result.link || 'SerpAPI / DFPI';

            return {
                entityName: cleanTitle(result.title),
                licenseNumber: extractLicenseNumber(text),
                licenseType: extractLicenseType(text),
                licenseStatus: extractStatus(text),
                address: '',
                source,
                rawJson: JSON.stringify(result)
            };
        })
        .filter(row => {
            const url = (row.source || '').toLowerCase();

            return (
                url.includes('/enforcement_action/') ||
                url.includes('/regulated-industries/regulated-entities-list/')
            );
        })
        .slice(0, 25);
}

function cleanTitle(title) {
    if (!title) return '';

    return title
        .replace(' - DFPI - CA.gov', '')
        .replace(' - DFPI', '')
        .trim();
}

function extractLicenseNumber(text) {
    const match =
        text.match(/60DBO[-\s]?\d+/i) ||
        text.match(/603[A-Z0-9]+/i) ||
        text.match(/CFL\s*#?\s*60DBO[-\s]?\d+/i);

    return match ? match[0].replace(/^CFL\s*#?\s*/i, '') : '';
}

function extractLicenseType(text) {
    const lower = text.toLowerCase();

    if (
        lower.includes('california finance lender') ||
        lower.includes('california financing law') ||
        lower.includes('cfl')
    ) {
        return 'California Finance Lender and Broker';
    }

    return 'DFPI Search Result';
}

function extractStatus(text) {
    const match =
        text.match(/\bActive\b/i) ||
        text.match(/\bInactive\b/i) ||
        text.match(/\bRevoked\b/i) ||
        text.match(/\bSurrendered\b/i) ||
        text.match(/\bSuspended\b/i) ||
        text.match(/\bExpired\b/i);

    return match ? match[0] : '';
}
