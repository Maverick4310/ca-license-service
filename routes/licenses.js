import express from 'express';
import { searchDFPI } from '../services/dfpiService.js';
import { scoreMatches } from '../services/scoringService.js';

const router = express.Router();

router.post('/search', async (req, res) => {

    try {

        const {
            name,
            address,
            website,
            phone
        } = req.body;

        const rawResults = await searchDFPI(name);

        const scored = scoreMatches({
            name,
            address,
            website,
            phone,
            results: rawResults
        });

        res.json(scored.slice(0, 10));

    } catch (e) {

        console.error(e);

        res.status(500).json({
            success: false,
            message: e.message
        });
    }
});

export default router;
