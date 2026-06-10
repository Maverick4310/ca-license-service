export async function searchDFPI(companyName) {
    if (!companyName) {
        return [];
    }

    const url =
        'https://dfpi.ca.gov/regulated-industries/regulated-entities-list/' +
        `?searchStudioQuery=${encodeURIComponent(companyName)}` +
        '&isGrid=false' +
        '&facets=fq%3Dss_content_type_s%3A%22Regulated%2520Entity%22' +
        '&orderBy=' +
        '&start=0' +
        '&model=DFPI';

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        throw new Error(`DFPI regulated entity search failed with status ${response.status}`);
    }

    const html = await response.text();

    return parseRegulatedEntityResults(html)
        .filter(row => row.entityName)
        .slice(0, 25);
}

function parseRegulatedEntityResults(html) {
    const text = stripHtml(html);

    const chunks = text
        .split('REGULATED ENTITY')
        .map(x => x.trim())
        .filter(x => x.includes('License Number:'));

    return chunks.map(chunk => {
        const entityName = extractEntityName(chunk);
        const licenseNumber = extractValue(chunk, /License Number:\s*([^\s]+)/i);
        const licenseStatus = extractValue(chunk, /Status:\s*([A-Za-z]+)/i);
        const effectiveDate = extractValue(chunk, /Effective Status Date:\s*([0-9/]+)/i);
        const licenseType = extractValue(chunk, /License Type:\s*([^A]+?)(?=Address1:|$)/i);
        const address = extractAddress(chunk);

        return {
            entityName,
            licenseNumber,
            licenseType: licenseType || 'California Finance Lender and Broker',
            licenseStatus,
            address,
            source: 'DFPI Regulated Entities List',
            rawJson: JSON.stringify({
                entityName,
                licenseNumber,
                licenseStatus,
                effectiveDate,
                licenseType,
                address,
                rawText: chunk
            })
        };
    });
}

function extractEntityName(chunk) {
    const lines = chunk
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    for (const line of lines) {
        if (
            !line.includes(':') &&
            !line.toLowerCase().includes('license') &&
            line.length > 2
        ) {
            return line.replace(/\.$/, '.');
        }
    }

    return '';
}

function extractAddress(chunk) {
    const address1 = extractValue(chunk, /Address1:\s*([^A]+?)(?=Address2:|City:|State:|Zip:|Registration Type:|$)/i);
    const address2 = extractValue(chunk, /Address2:\s*([^C]+?)(?=City:|State:|Zip:|Registration Type:|$)/i);
    const city = extractValue(chunk, /City:\s*([^S]+?)(?=State:|Zip:|Registration Type:|$)/i);
    const state = extractValue(chunk, /State:\s*([^Z]+?)(?=Zip:|Registration Type:|$)/i);
    const zip = extractValue(chunk, /Zip:\s*([0-9\-]+)/i);

    return [address1, address2, city, state, zip]
        .filter(Boolean)
        .join(', ');
}

function extractValue(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/&#8211;/g, '-')
        .replace(/&#8217;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
}
