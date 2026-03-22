const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const configRoutes = require('./routes/configRoutes');
const leagueFilterRoutes = require('./routes/leagueFilterRoutes');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3291;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration API
app.use('/api/configs', configRoutes);
app.use('/api/league-filter', leagueFilterRoutes);

// --- Process Management ---
let childProcess = null;

app.get('/api/process/status', (req, res) => {
    res.json({ running: childProcess !== null && !childProcess.killed });
});

app.post('/api/process/start', (req, res) => {
    if (childProcess && !childProcess.killed) {
        return res.status(400).json({ error: 'Process is already running' });
    }

    try {
        childProcess = spawn('node', ['express.js'], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });

        childProcess.stdout.on('data', (data) => {
            process.stdout.write(`[APP] ${data}`);
        });

        childProcess.stderr.on('data', (data) => {
            process.stderr.write(`[APP ERR] ${data}`);
        });

        childProcess.on('close', (code) => {
            console.log(`[APP] Process exited with code ${code}`);
            childProcess = null;
        });

        childProcess.on('error', (err) => {
            console.error(`[APP] Failed to start process:`, err);
            childProcess = null;
        });

        res.json({ success: true, pid: childProcess.pid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/process/stop', (req, res) => {
    if (!childProcess || childProcess.killed) {
        childProcess = null;
        return res.status(400).json({ error: 'No process is running' });
    }

    try {
        // On Windows, use taskkill to kill the process tree
        const kill = spawn('taskkill', ['/pid', childProcess.pid.toString(), '/f', '/t'], { shell: true });
        kill.on('close', () => {
            childProcess = null;
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dashboard Server running on http://localhost:${PORT}`);
});
