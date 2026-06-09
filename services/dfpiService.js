import puppeteer from 'puppeteer';

const DFPI_URL =
    'https://dfpi.ca.gov/regulated-industries/regulated-entities-list/';

export async function searchDFPI(companyName) { 

    const browser =
        await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

    try {

        const page =
            await browser.newPage();

        await page.goto(
            DFPI_URL,
            {
                waitUntil: 'networkidle2',
                timeout: 60000
            }
        );

        const selectors = [
            'input[type="search"]',
            'input[name="s"]',
            '.search-field'
        ];

        let found = false;

        for (const selector of selectors) {

            const exists =
                await page.$(selector);

            if (exists) {

                await page.click(selector);

                await page.keyboard.down('Control');
                await page.keyboard.press('A');
                await page.keyboard.up('Control');

                await page.keyboard.type(
                    `"${companyName}"`
                );

                await page.keyboard.press('Enter');

                found = true;
                break;
            }
        }

        if (!found) {
            throw new Error(
                'Search field not found.'
            );
        }

        await page.waitForTimeout(5000);

        const results =
            await page.evaluate(() => {

                const rows = [];

                document
                    .querySelectorAll(
                        'article, tr, li'
                    )
                    .forEach(node => {

                        const text =
                            node.innerText?.trim();

                        if (
                            text &&
                            text.length > 30
                        ) {

                            rows.push(text);
                        }
                    });

                return rows;
            });

        return results.map(text => {

            const lines =
                text
                    .split('\n')
                    .map(x => x.trim())
                    .filter(Boolean);

            return {
                entityName:
                    lines[0] || '',
                licenseNumber: '',
                licenseType:
                    'California Financing Law',
                licenseStatus: '',
                address:
                    lines.slice(1, 4).join(', '),
                source: 'DFPI',
                rawJson:
                    JSON.stringify({
                        text
                    })
            };
        });

    } finally {

        await browser.close();
    }
}
