const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const leagueFilterPath = path.resolve(__dirname, '../run/brain/leagueFilter.json');

// Read league filter
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(leagueFilterPath)) {
            return res.status(404).json({ error: 'League filter file not found' });
        }
        const data = fs.readFileSync(leagueFilterPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update league filter
router.post('/', (req, res) => {
    try {
        fs.writeFileSync(leagueFilterPath, JSON.stringify(req.body, null, 2));
        console.log('[CONFIG] Updated leagueFilter.json');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
