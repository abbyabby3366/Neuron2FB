const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const targetBookiePath = path.resolve(__dirname, '../TargetBookie');

// Helper to check if file exists and is in TargetBookie
const getFilePath = (filename) => {
    const filePath = path.join(targetBookiePath, filename);
    if (!filePath.startsWith(targetBookiePath)) {
        throw new Error('Access denied');
    }
    return filePath;
};

// List all config files
router.get('/', (req, res) => {
    fs.readdir(targetBookiePath, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.toLowerCase().includes('data'));
        res.json(jsonFiles);
    });
});

// Read a config file
router.get('/:filename', (req, res) => {
    try {
        const filePath = getFilePath(req.params.filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create/Update a config file
router.post('/:filename', (req, res) => {
    try {
        const filePath = getFilePath(req.params.filename);
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a config file
router.delete('/:filename', (req, res) => {
    try {
        const filePath = getFilePath(req.params.filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
