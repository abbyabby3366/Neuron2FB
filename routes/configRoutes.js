const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { getObjectDiff } = require('../public/logDiff');

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
        let oldData = {};
        if (fs.existsSync(filePath)) {
            oldData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        const diff = getObjectDiff(oldData, req.body);
        
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        if (Object.keys(diff).length > 0) {
            console.log(`[CONFIG] Updated ${req.params.filename} - Changes:`, diff);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk update for main parameters (webhook handler)
router.post('/save-params', (req, res) => {
    const params = req.body;
    try {
        const sboPath = getFilePath('sbo0.json');
        const psPath = getFilePath('ps38380.json');
        const mainParamsPath = path.resolve(__dirname, '../mainParams.json');

        const oldSbo = fs.existsSync(sboPath) ? JSON.parse(fs.readFileSync(sboPath, 'utf8')) : {};
        const oldPs = fs.existsSync(psPath) ? JSON.parse(fs.readFileSync(psPath, 'utf8')) : {};

        const diffSbo = getObjectDiff(oldSbo, params.SBO_param);
        const diffPs = getObjectDiff(oldPs, params.PS3838_params);

        fs.writeFileSync(sboPath, JSON.stringify(params.SBO_param, null, 2));
        fs.writeFileSync(psPath, JSON.stringify(params.PS3838_params, null, 2));

        const mainParams = {
            instance_id: params.instance_id,
            webhook_ip: params.webhook_ip,
            run: params.run,
        };
        fs.writeFileSync(mainParamsPath, JSON.stringify(mainParams, null, 2));

        if (Object.keys(diffSbo).length > 0) {
            console.log(`[PARAMS] Changes in sbo0:`, diffSbo);
        }
        if (Object.keys(diffPs).length > 0) {
            console.log(`[PARAMS] Changes in ps38380:`, diffPs);
        }

        res.json({ success: true, message: 'Parameters updated successfully' });
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
