export interface AppUsageUpdate {
  key: string;
  appName: string;
}

export interface UserApps {
  [appName: string]: string; // timestamp ISO string
}

export interface UserData {
  apps: UserApps;
}

export interface Users {
  [key: string]: UserData;
}