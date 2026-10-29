import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { searchDFPI } from '../services/dfpiService.js';
import { scoreMatches } from '../services/scoringService.js';

const router = express.Router();

router.post(
    '/search',
    requireAuth,
    async (req, res) => {

        try {

            const {
                name,
                address,
                website,
                phone
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Company name is required.'
                });
            }

            const rawResults =
                await searchDFPI(name);

            const scored =
                scoreMatches({
                    name,
                    address,
                    website,
                    phone,
                    results: rawResults
                });

            res.json(scored.slice(0, 10));

        } catch (e) {

            console.error(e);

            // DFPI busy or down: tell Salesforce so it can show a friendly
            // message instead of a raw failure.
            const upstream = e.upstreamStatus;
            const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
            if (upstream === 429 || (upstream >= 500) || timedOut) {
                return res.status(503).json({
                    success: false,
                    code: upstream === 429 ? 'DFPI_BUSY' : 'DFPI_UNAVAILABLE',
                    message: e.message
                });
            }

            res.status(500).json({
                success: false,
                message: e.message
            });
        }
    }
);

export default router;
