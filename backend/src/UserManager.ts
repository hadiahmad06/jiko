import type { Users } from './types.js';

class UserManager {
  private users: Users = {};

  startApp(key: string, appName: string) {
    const timestamp = new Date().toISOString();
    if (!this.users[key]) this.users[key] = { apps: {} };
    this.users[key].apps[appName] = timestamp;
    console.log(`Using app "${appName}" for key ${key} since ${timestamp}`);
  }

  stopApp(key: string, appName: string) {
    if (!this.users[key] || !this.users[key].apps[appName]) return;
    const timestamp = new Date().toISOString();
    delete this.users[key].apps[appName];
    console.log(`Stopped using app "${appName}" for key ${key} at ${timestamp}`);
  }
}

export default new UserManager();