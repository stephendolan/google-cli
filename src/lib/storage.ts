import * as fs from 'node:fs';
import * as path from 'node:path';
import { getConfigDir } from './config.js';

const SERVICE = 'google-cli';

export interface StorageBackend {
  get(profile: string, key: string): Promise<string | null>;
  set(profile: string, key: string, value: string): Promise<boolean>;
  delete(profile: string, key: string): Promise<boolean>;
  deleteProfile(profile: string): Promise<boolean>;
}

interface FileCredentials {
  version: 1;
  profile: string;
  client_id?: string;
  client_secret?: string;
  tokens?: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  };
}

class KeyringBackend implements StorageBackend {
  private keyringModule: typeof import('@napi-rs/keyring') | null = null;

  private async getKeyring(): Promise<typeof import('@napi-rs/keyring') | null> {
    if (this.keyringModule !== null) return this.keyringModule;
    try {
      this.keyringModule = await import('@napi-rs/keyring');
      return this.keyringModule;
    } catch {
      return null;
    }
  }

  private async withEntry<T>(
    entryKey: string,
    operation: (entry: import('@napi-rs/keyring').Entry) => T,
    fallback: T
  ): Promise<T> {
    const keyring = await this.getKeyring();
    if (!keyring) return fallback;
    try {
      const entry = new keyring.Entry(SERVICE, entryKey);
      return operation(entry);
    } catch {
      return fallback;
    }
  }

  private profileKey(profile: string, key: string): string {
    return `profile:${profile}:${key}`;
  }

  async get(profile: string, key: string): Promise<string | null> {
    return this.withEntry(this.profileKey(profile, key), (e) => e.getPassword(), null);
  }

  async set(profile: string, key: string, value: string): Promise<boolean> {
    return this.withEntry(
      this.profileKey(profile, key),
      (e) => {
        e.setPassword(value);
        return true;
      },
      false
    );
  }

  async delete(profile: string, key: string): Promise<boolean> {
    return this.withEntry(this.profileKey(profile, key), (e) => e.deletePassword(), false);
  }

  async deleteProfile(profile: string): Promise<boolean> {
    const keys = ['client_id', 'client_secret', 'tokens'];
    const results = await Promise.all(keys.map((key) => this.delete(profile, key)));
    return results.every(Boolean);
  }

  async getOldKey(key: string): Promise<string | null> {
    return this.withEntry(key, (e) => e.getPassword(), null);
  }

  async deleteOldKey(key: string): Promise<boolean> {
    return this.withEntry(key, (e) => e.deletePassword(), false);
  }
}

function getCredentialsDir(): string {
  return process.env.GOOGLE_CLI_CONFIG_DIR ?? path.join(getConfigDir(), 'credentials');
}

class FileBackend implements StorageBackend {
  private getFilePath(profile: string): string {
    return path.join(getCredentialsDir(), `${profile}.json`);
  }

  private ensureDir(): void {
    const dir = getCredentialsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  private readProfile(profile: string): FileCredentials | null {
    const filePath = this.getFilePath(profile);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as FileCredentials;
    } catch {
      return null;
    }
  }

  private writeProfile(profile: string, data: FileCredentials): boolean {
    try {
      this.ensureDir();
      const filePath = this.getFilePath(profile);
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
      fs.renameSync(tempPath, filePath);
      return true;
    } catch {
      return false;
    }
  }

  async get(profile: string, key: string): Promise<string | null> {
    const data = this.readProfile(profile);
    if (!data) return null;

    switch (key) {
      case 'client_id':
        return data.client_id ?? null;
      case 'client_secret':
        return data.client_secret ?? null;
      case 'tokens':
        return data.tokens ? JSON.stringify(data.tokens) : null;
      default:
        return null;
    }
  }

  async set(profile: string, key: string, value: string): Promise<boolean> {
    const data = this.readProfile(profile) ?? {
      version: 1,
      profile,
    };

    switch (key) {
      case 'client_id':
        data.client_id = value;
        break;
      case 'client_secret':
        data.client_secret = value;
        break;
      case 'tokens':
        data.tokens = JSON.parse(value);
        break;
      default:
        return false;
    }

    return this.writeProfile(profile, data);
  }

  async delete(profile: string, key: string): Promise<boolean> {
    const data = this.readProfile(profile);
    if (!data) return true;

    switch (key) {
      case 'client_id':
        delete data.client_id;
        break;
      case 'client_secret':
        delete data.client_secret;
        break;
      case 'tokens':
        delete data.tokens;
        break;
      default:
        return false;
    }

    return this.writeProfile(profile, data);
  }

  async deleteProfile(profile: string): Promise<boolean> {
    const filePath = this.getFilePath(profile);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }
}

let cachedBackend: StorageBackend | null = null;

export function getStorageBackend(): StorageBackend {
  if (cachedBackend) return cachedBackend;

  const mode = process.env.GOOGLE_CLI_STORAGE?.toLowerCase() ?? 'keyring';
  cachedBackend = mode === 'file' ? new FileBackend() : new KeyringBackend();
  return cachedBackend;
}

export function getKeyringBackend(): KeyringBackend {
  return new KeyringBackend();
}
