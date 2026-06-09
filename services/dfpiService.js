import { chromium } from 'playwright-chromium';

const DFPI_URL = 'https://dfpi.ca.gov/regulated-industries/regulated-entities-list/'; 

export async function searchDFPI(companyName) {
    if (!companyName) {
        return [];
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.goto(DFPI_URL, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        const searchBox = await findSearchBox(page);

        if (!searchBox) {
            throw new Error('DFPI search input was not found.');
        }

        await searchBox.fill(`"${companyName}"`);
        await searchBox.press('Enter');

        await page.waitForTimeout(4000);

        const rows = await page.evaluate(() => {
            const textBlocks = [];

            document.querySelectorAll('article, .wp-block-post, .entry, .card, li, tr').forEach(el => {
                const text = el.innerText?.trim();

                if (text && text.length > 20) {
                    textBlocks.push(text);
                }
            });

            return textBlocks;
        });

        return rows
            .map(parseDfpiTextBlock)
            .filter(row => row.entityName)
            .slice(0, 25);

    } finally {
        await browser.close();
    }
}

async function findSearchBox(page) {
    const selectors = [
        'input[type="search"]',
        'input[name="s"]',
        'input[placeholder*="Search"]',
        'input[aria-label*="Search"]',
        '.search-field'
    ];

    for (const selector of selectors) {
        const locator = page.locator(selector).first();

        if (await locator.count()) {
            return locator;
        }
    }

    return null;
}

function parseDfpiTextBlock(text) {
    const licenseMatch =
        text.match(/60DBO[-\s]?\d+/i) ||
        text.match(/license\s*(no\.?|number)?\s*[:#]?\s*([A-Z0-9-]+)/i);

    const statusMatch =
        text.match(/\b(active|inactive|revoked|surrendered|suspended|expired|licensed)\b/i);

    const lines = text
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    return {
        entityName: lines[0] || '',
        licenseNumber: licenseMatch ? licenseMatch[0] : '',
        licenseType: text.toLowerCase().includes('california financing')
            ? 'California Financing Law'
            : 'DFPI Regulated Entity',
        licenseStatus: statusMatch ? statusMatch[0] : '',
        address: lines.slice(1, 4).join(', '),
        source: 'DFPI',
        rawJson: JSON.stringify({ text })
    };
}
