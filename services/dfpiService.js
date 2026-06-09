import axios from 'axios';

const DFPI_SEARCH_URL = 'https://dfpi.ca.gov/';

export async function searchDFPI(companyName) {
    if (!companyName) {
        return [];
    }

    const searchUrl =
        `${DFPI_SEARCH_URL}?s=${encodeURIComponent(companyName)}`;

    const response = await axios.get(searchUrl, {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html'
        }
    });

    const html = response.data || '';

    const blocks = extractSearchBlocks(html);

    return blocks
        .map(parseDfpiBlock)
        .filter(row => row.entityName)
        .slice(0, 25);
}

function extractSearchBlocks(html) {
    const blocks = [];

    const articleRegex = /<article[\s\S]*?<\/article>/gi;
    const matches = html.match(articleRegex) || [];

    for (const match of matches) {
        const text = stripHtml(match);

        if (text.length > 30) {
            blocks.push(text);
        }
    }

    return blocks;
}

function parseDfpiBlock(text) {
    const lines = text
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    const licenseMatch =
        text.match(/60DBO[-\s]?\d+/i) ||
        text.match(/License\s*(No\.?|Number)?\s*[:#]?\s*([A-Z0-9-]+)/i);

    const statusMatch =
        text.match(/\bActive\b/i) ||
        text.match(/\bInactive\b/i) ||
        text.match(/\bRevoked\b/i) ||
        text.match(/\bSurrendered\b/i) ||
        text.match(/\bSuspended\b/i) ||
        text.match(/\bExpired\b/i);

    return {
        entityName: lines[0] || '',
        licenseNumber: licenseMatch ? licenseMatch[0] : '',
        licenseType: text.toLowerCase().includes('california financing')
            ? 'California Financing Law'
            : 'DFPI Search Result',
        licenseStatus: statusMatch ? statusMatch[0] : '',
        address: lines.slice(1, 4).join(', '),
        source: 'DFPI',
        rawJson: JSON.stringify({ text })
    };
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
