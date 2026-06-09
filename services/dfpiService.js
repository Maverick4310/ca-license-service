import puppeteer from 'puppeteer';

const DFPI_URL =
    'https://dfpi.ca.gov/regulated-industries/regulated-entities-list/';

export async function searchDFPI(companyName) {
    if (!companyName) {
        return [];
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    try {
        const page = await browser.newPage();

        await page.goto(DFPI_URL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        const selector = await findSearchSelector(page);

        if (!selector) {
            throw new Error('Search field not found.');
        }

        await page.$eval(
            selector,
            (el, value) => {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            },
            `"${companyName}"`
        );

        await page.keyboard.press('Enter');

        await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 30000
        }).catch(() => null);

        await page.waitForTimeout(3000);

        const results = await page.evaluate(() => {
            const rows = [];

            document
                .querySelectorAll('article, tr, li, .entry-content, .wp-block-post')
                .forEach(node => {
                    const text = node.innerText?.trim();

                    if (text && text.length > 30) {
                        rows.push(text);
                    }
                });

            return rows;
        });

        return results
            .map(parseDfpiTextBlock)
            .filter(row => row.entityName)
            .slice(0, 25);

    } finally {
        await browser.close();
    }
}

async function findSearchSelector(page) {
    const selectors = [
        'input[type="search"]',
        'input[name="s"]',
        'input.search-field',
        '.search-field',
        'input[placeholder*="Search"]',
        'input[aria-label*="Search"]'
    ];

    for (const selector of selectors) {
        const count = await page.$$eval(selector, nodes => {
            return nodes.filter(node => {
                const style = window.getComputedStyle(node);
                return (
                    node instanceof HTMLInputElement &&
                    style &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    !node.disabled
                );
            }).length;
        }).catch(() => 0);

        if (count > 0) {
            return selector;
        }
    }

    return null;
}

function parseDfpiTextBlock(text) {
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
            : 'DFPI Regulated Entity',
        licenseStatus: statusMatch ? statusMatch[0] : '',
        address: lines.slice(1, 4).join(', '),
        source: 'DFPI',
        rawJson: JSON.stringify({ text })
    };
}
