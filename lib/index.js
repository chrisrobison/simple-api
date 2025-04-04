// lib/index.js

const DataService = require('./DataService');
const Boss = require('./Boss');
const ClassLoader = require('./ClassLoader');
const { authMiddleware, optionalAuth } = require('./auth');

module.exports = {
    // Core services
    DataService,
    Boss,
    ClassLoader,

    // Middleware
    authMiddleware,
    optionalAuth,

    // Custom controllers (for direct access if needed)
    UserController: require('./custom/UserController')
};
