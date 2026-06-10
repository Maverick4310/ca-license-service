/**
 * DFPI Regulated Entities lookup.
 *
 * The DFPI "Regulated Entities List" page (dfpi.ca.gov/regulated-industries/
 * regulated-entities-list/) is a SearchStax Site Search front end. The license
 * records you see on that page are NOT served by Google -- they come from a
 * Solr `/emselect` endpoint that the page calls in the browser.
 *
 * SERP API (Google scraping) can only ever return DFPI's static, indexed pages
 * (press releases, enforcement actions, the site map), which is why the old
 * implementation returned news instead of license records. This module talks to
 * the real `/emselect` endpoint instead.
 *
 * Required configuration (read these straight out of your browser DevTools:
 * Network tab -> the `emselect?q=...` request -> Headers):
 *
 *   DFPI_SEARCH_URL    Full select endpoint, e.g.
 *                      https://searchcloud-2-us-east-1.searchstax.com/<acct>/<app>/emselect
 *                      (Request URL of the emselect call, minus the query string)
 *   DFPI_SEARCH_TOKEN  Read-only token from the request's
 *                      `Authorization: Token <value>` header (value only)
 *
 * Optional:
 *   DFPI_SEARCH_ROWS   How many rows to request (default 25)
 */

const SOURCE_BASE =
    'https://dfpi.ca.gov/regulated-industries/regulated-entities-list/';

export async function searchDFPI(companyName, options = {}) {
    if (!companyName) {
        return [];
    }

    const endpoint = options.endpoint || process.env.DFPI_SEARCH_URL;
    const token = options.token || process.env.DFPI_SEARCH_TOKEN;

    if (!endpoint) {
        throw new Error(
            'DFPI_SEARCH_URL is not configured. Copy the full /emselect ' +
            'Request URL from DevTools (Network tab) without its query string.'
        );
    }

    const rows = Number(options.rows || process.env.DFPI_SEARCH_ROWS || 25);

    // Mirror the params the DFPI page sends, scoped to regulated entities only.
    const params = new URLSearchParams({
        q: companyName,
        fq: 'ss_content_type_s:"Regulated Entity"',
        defType: 'edismax',
        // Match the name across the same fields the site weights most heavily.
        qf: 'title_t^77.0 dba_names_t dba_names_s custom_xpath_t content_t',
        qs: '2',
        fl: 'id,title_t,sorttitle_sortable,ss_content_type_s,custom_xpath_t,uri,Registration_Types_s,License_Status_Reason_s',
        rows: String(rows),
        start: String(options.start || 0),
        language: 'en',
        wt: 'json'
    });

    const url = `${endpoint}?${params.toString()}`;

    // SearchStax Site Search typically validates the browser Origin/Referer
    // rather than (or in addition to) a token. A bare server-side request gets
    // a 403, which is the usual reason a "direct callout doesn't work". Sending
    // the same Origin/Referer/User-Agent the DFPI page uses makes the request
    // look legitimate. CORS is browser-enforced only, so a server may set these.
    const headers = {
        Accept: 'application/json',
        Origin:
            options.origin ||
            process.env.DFPI_SEARCH_ORIGIN ||
            'https://dfpi.ca.gov',
        Referer:
            options.referer ||
            process.env.DFPI_SEARCH_REFERER ||
            'https://dfpi.ca.gov/',
        'User-Agent':
            options.userAgent ||
            process.env.DFPI_SEARCH_UA ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };
    if (token) {
        headers.Authorization = `Token ${token}`;
    }

    const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        const hint =
            response.status === 401 || response.status === 403
                ? ' (auth/origin rejected -- if the request carries an ' +
                  'Authorization header in DevTools set DFPI_SEARCH_TOKEN; ' +
                  'otherwise the endpoint is gating on Origin/Referer, which ' +
                  'this client already sends)'
                : '';
        throw new Error(
            `DFPI /emselect failed with status ${response.status}${hint}`
        );
    }

    const data = await response.json();
    const docs = (data && data.response && data.response.docs) || [];

    return docs
        .map(toLicenseRecord)
        .filter(row => row.entityName || row.licenseNumber);
}

function toLicenseRecord(doc) {
    const fields = parseCustomXpath(doc.custom_xpath_t || '');

    const entityName =
        fields['Legal Name Organization'] ||
        cleanTitle(doc.title_t || '');

    const address = [
        fields['Address1'],
        fields['Address2'],
        fields['City'],
        fields['State'],
        fields['Zip']
    ]
        .filter(Boolean)
        .join(', ');

    const uri = doc.uri || '';
    const source = uri
        ? SOURCE_BASE + uri.replace(/^\//, '')
        : SOURCE_BASE;

    return {
        entityName,
        licenseNumber: fields['License Number'] || '',
        licenseType: fields['License Type'] || '',
        licenseStatus: fields['Status'] || '',
        address,
        // Extra structured fields (passed through by the scorer untouched).
        dba: stripNulls(fields['Organization DBA'] || ''),
        effectiveStatusDate: fields['Effective Status Date'] || '',
        originallyLicensedOn: fields['Originally Licensed On'] || '',
        registrationType:
            fields['Registration Type'] ||
            (doc.Registration_Types_s || ''),
        licenseStatusReason:
            fields['License Status Reason'] ||
            (doc.License_Status_Reason_s || ''),
        enforcementCase: fields['Enforcement Case'] || '',
        source,
        rawJson: JSON.stringify(doc)
    };
}

/**
 * custom_xpath_t is a newline-delimited "Key: Value" block. Parse it into a map,
 * splitting only on the first colon so values containing colons survive.
 */
function parseCustomXpath(text) {
    const out = {};

    String(text)
        .split('\n')
        .forEach(line => {
            const idx = line.indexOf(':');
            if (idx === -1) {
                return;
            }
            const key = line.slice(0, idx).trim();
            const value = stripNulls(line.slice(idx + 1).trim());
            if (key) {
                out[key] = value;
            }
        });

    return out;
}

function stripNulls(value) {
    // The feed uses a literal NULL char (\u0000) for empty DBA values.
    return value.replace(/\u0000/g, '').trim();
}

function cleanTitle(title) {
    return title
        .replace(' - DFPI - CA.gov', '')
        .replace(' - DFPI', '')
        .replace(' - CA.gov', '')
        .trim();
}
