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
                entityName: extractEntityName(result, companyName),
                licenseNumber: extractLicenseNumber(text),
                licenseType: extractLicenseType(text),
                licenseStatus: extractStatus(text),
                address: extractAddress(text),
                source,
                rawJson: JSON.stringify(result)
            };
        })
        .filter(row => {
            return row.entityName || row.licenseNumber || row.source;
        })
        .slice(0, 25);
}

function extractEntityName(result, fallbackName) {
    const title = cleanTitle(result.title || '');

    if (
        title &&
        !title.toLowerCase().includes('dfpi') &&
        !title.toLowerCase().includes('news') &&
        !title.toLowerCase().includes('consumers') &&
        !title.toLowerCase().includes('site map') &&
        !title.toLowerCase().includes('press releases')
    ) {
        return title;
    }

    const snippet = result.snippet || '';

    const legalMatch =
        snippet.match(/Legal Name Organization:\s*([^\.]+?)(?=Organization DBA:|Originally Licensed On:|License Type:|Address1:|$)/i) ||
        snippet.match(/Party\.\s*([^\.]+?)(?=Documents|Date|$)/i);

    if (legalMatch) {
        return legalMatch[1].trim();
    }

    return fallbackName;
}

function cleanTitle(title) {
    return title
        .replace(' - DFPI - CA.gov', '')
        .replace(' - DFPI', '')
        .replace(' - CA.gov', '')
        .trim();
}

function extractLicenseNumber(text) {
    const match =
        text.match(/License Number:\s*([A-Z0-9-]+)/i) ||
        text.match(/License or Case Number\s*CFL\s*#?\s*([A-Z0-9-]+)/i) ||
        text.match(/CFL\s*#?\s*(60DBO[-\s]?\d+)/i) ||
        text.match(/60DBO[-\s]?\d+/i) ||
        text.match(/603[A-Z0-9]+/i);

    if (!match) {
        return '';
    }

    return (match[1] || match[0])
        .replace(/^License Number:\s*/i, '')
        .replace(/^License or Case Number\s*/i, '')
        .replace(/^CFL\s*#?\s*/i, '')
        .trim();
}

function extractLicenseType(text) {
    const match = text.match(/License Type:\s*([^\.]+?)(?=Address1:|Address2:|City:|State:|Zip:|$)/i);

    if (match) {
        return match[1].trim();
    }

    const lower = text.toLowerCase();

    if (
        lower.includes('california finance lender') ||
        lower.includes('california financing law') ||
        lower.includes('finance lender and broker') ||
        lower.includes('cfl')
    ) {
        return 'California Finance Lender and Broker';
    }

    return 'DFPI Search Result';
}

function extractStatus(text) {
    const match =
        text.match(/Status:\s*([A-Za-z]+)/i) ||
        text.match(/\bActive\b/i) ||
        text.match(/\bInactive\b/i) ||
        text.match(/\bRevoked\b/i) ||
        text.match(/\bSurrendered\b/i) ||
        text.match(/\bSuspended\b/i) ||
        text.match(/\bExpired\b/i);

    return match ? (match[1] || match[0]).trim() : '';
}

function extractAddress(text) {
    const address1 = extractValue(text, /Address1:\s*([^\.]+?)(?=Address2:|City:|State:|Zip:|$)/i);
    const address2 = extractValue(text, /Address2:\s*([^\.]+?)(?=City:|State:|Zip:|$)/i);
    const city = extractValue(text, /City:\s*([^\.]+?)(?=State:|Zip:|$)/i);
    const state = extractValue(text, /State:\s*([^\.]+?)(?=Zip:|$)/i);
    const zip = extractValue(text, /Zip:\s*([0-9\-]+)/i);

    return [address1, address2, city, state, zip]
        .filter(Boolean)
        .join(', ');
}

function extractValue(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}
