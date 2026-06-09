export function requireAuth(req, res, next) {

    const authHeader = req.headers.authorization || '';

    const token =
        authHeader.replace('Bearer ', '').trim();

    if (token !== process.env.API_TOKEN) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }

    next();
}
