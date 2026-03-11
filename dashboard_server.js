const express = require('express');
const path = require('path');
const configRoutes = require('./routes/configRoutes');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3291;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration API
app.use('/api/configs', configRoutes);

// Serve Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dashboard Server running on http://localhost:${PORT}`);
});
