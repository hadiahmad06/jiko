// routes/stopApp.js
const express = require('express');
const router = express.Router();
const userManager = require('../UserManager');

router.post('/', (req, res) => {
    const { key, appName } = req.body;
    if (!key || !appName) return res.status(400).json({ error: 'Missing key or appName' });

    userManager.stopApp(key, appName);
    res.json({ status: 'stopped', key, appName });
});

module.exports = router;