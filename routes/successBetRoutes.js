const express = require('express');
const router = express.Router();
const { readData } = require('../mongodb/db');

// GET /api/success-bets?key=<successBetListKey>&acc=<accId>&period=<today|yesterday|7d|week|month>&page=<n>&limit=<n>
router.get('/', async (req, res) => {
    try {
        const { key, acc, period, page = 1, limit = 50 } = req.query;

        // Build MongoDB query (non-time fields only)
        const query = {};
        if (key) query.successBetListKey = key;
        if (acc) query.acc = acc;

        const allData = await readData('successBetList', query);

        // Filter by time period in JS (timeScraped is stored as a locale string)
        let filtered = allData;
        if (period) {
            const now = new Date();
            let startDate, endDate;

            switch (period) {
                case 'today': {
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 1);
                    break;
                }
                case 'yesterday': {
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                }
                case '7d': {
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                }
                case 'week': {
                    // Last full week (Mon-Sun)
                    const dayOfWeek = now.getDay(); // 0=Sun
                    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
                    endDate = new Date(thisMonday);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                }
                case 'month': {
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                    break;
                }
            }

            if (startDate && endDate) {
                filtered = allData.filter(bet => {
                    const betTime = new Date(bet.timeScraped);
                    return betTime >= startDate && betTime < endDate;
                });
            }
        }

        // Sort newest first
        filtered.sort((a, b) => new Date(b.timeScraped) - new Date(a.timeScraped));

        // Paginate
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
        const total = filtered.length;
        const totalPages = Math.ceil(total / limitNum);
        const start = (pageNum - 1) * limitNum;
        const paginated = filtered.slice(start, start + limitNum);

        res.json({
            data: paginated,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages
            }
        });
    } catch (err) {
        console.error('[SUCCESS-BETS] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
