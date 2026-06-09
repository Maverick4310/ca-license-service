export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!process.env.API_TOKEN) {
        return res.status(500).json({
            success: false,
            message: 'API token is not configured.'
        });
    }

    if (token !== process.env.API_TOKEN) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized.'
        });
    }

    next();
}
