import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GoogleCliError } from './errors.js';

const PROFILE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

interface ProfileConfig {
  email?: string;
}

interface Config {
  activeProfile: string;
  profiles: Record<string, ProfileConfig>;
}

function getConfigDir(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'google-cli');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'google-cli');
  }
  return path.join(os.homedir(), '.config', 'google-cli');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDefaultConfig(): Config {
  return {
    activeProfile: 'default',
    profiles: {},
  };
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return createDefaultConfig();
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as Config;
    if (!config.activeProfile || !config.profiles) {
      throw new GoogleCliError(
        `Config file is corrupted. Delete ${configPath} and re-authenticate.`
      );
    }
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new GoogleCliError(
        `Config file is corrupted (invalid JSON). Delete ${configPath} and re-authenticate.`
      );
    }
    throw error;
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function validateProfileName(name: string): void {
  if (!PROFILE_NAME_REGEX.test(name)) {
    throw new GoogleCliError(
      `Invalid profile name '${name}'. Use only letters, numbers, hyphens, and underscores.`
    );
  }
}

export function getActiveProfile(): string {
  const config = loadConfig();
  return config.activeProfile;
}

export function setActiveProfile(name: string): void {
  validateProfileName(name);
  const config = loadConfig();
  if (!config.profiles[name]) {
    throw new GoogleCliError(`Profile '${name}' not found.`);
  }
  config.activeProfile = name;
  saveConfig(config);
}

export function listProfiles(): string[] {
  const config = loadConfig();
  return Object.keys(config.profiles);
}

export function profileExists(name: string): boolean {
  const config = loadConfig();
  return name in config.profiles;
}

export function addProfile(name: string, email?: string): void {
  validateProfileName(name);
  const config = loadConfig();
  config.profiles[name] = { email };
  config.activeProfile = name;
  saveConfig(config);
}

export function removeProfile(name: string): void {
  validateProfileName(name);
  const config = loadConfig();

  if (!config.profiles[name]) {
    throw new GoogleCliError(`Profile '${name}' not found.`);
  }

  if (config.activeProfile === name) {
    throw new GoogleCliError(
      `Cannot delete active profile '${name}'. Switch to another profile first.`
    );
  }

  delete config.profiles[name];
  saveConfig(config);
}

export function getProfileEmail(name: string): string | undefined {
  const config = loadConfig();
  return config.profiles[name]?.email;
}

export function setProfileEmail(name: string, email: string): void {
  const config = loadConfig();
  if (!config.profiles[name]) {
    config.profiles[name] = {};
  }
  config.profiles[name].email = email;
  saveConfig(config);
}
