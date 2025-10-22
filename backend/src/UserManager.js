// UserManager.js
class UserManager {
    constructor() {
        this.users = {}; // key = userId, value = { apps: {} }
    }

    startApp(key, appName) {
        const timestamp = new Date().toISOString();
        if (!this.users[key]) this.users[key] = { apps: {} };
        this.users[key].apps[appName] = timestamp;
        console.log(`Using app "${appName}" for key ${key} since ${timestamp}`);
    }

    stopApp(key, appName) {
        if (!this.users[key] || !this.users[key].apps[appName]) return;
        const timestamp = new Date().toISOString();
        delete this.users[key].apps[appName];
        console.log(`Stopped using app "${appName}" for key ${key} at ${timestamp}`);
    }
}

module.exports = new UserManager(); // singleton