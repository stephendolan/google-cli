import { google } from 'googleapis';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import open from 'open';
import {
  getActiveProfile,
  addProfile,
  validateProfileName,
  profileExists,
  getProfileEmail,
} from './config.js';

const SERVICE = 'google-cli';
const REDIRECT_PORT = 8089;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

let authStateToken: string | null = null;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface Tokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

interface ClientCredentials {
  client_id: string;
  client_secret: string;
}

let keyringModule: typeof import('@napi-rs/keyring') | null = null;

async function getKeyring(): Promise<typeof import('@napi-rs/keyring') | null> {
  if (keyringModule !== null) return keyringModule;
  try {
    keyringModule = await import('@napi-rs/keyring');
    return keyringModule;
  } catch {
    return null;
  }
}

function profileKey(profile: string, key: string): string {
  return `profile:${profile}:${key}`;
}

async function getFromKeyring(account: string): Promise<string | null> {
  const keyring = await getKeyring();
  if (!keyring) return null;
  try {
    const entry = new keyring.Entry(SERVICE, account);
    return entry.getPassword();
  } catch {
    return null;
  }
}

async function setInKeyring(account: string, value: string): Promise<boolean> {
  const keyring = await getKeyring();
  if (!keyring) return false;
  try {
    const entry = new keyring.Entry(SERVICE, account);
    entry.setPassword(value);
    return true;
  } catch {
    return false;
  }
}

async function deleteFromKeyring(account: string): Promise<boolean> {
  const keyring = await getKeyring();
  if (!keyring) return false;
  try {
    const entry = new keyring.Entry(SERVICE, account);
    return entry.deletePassword();
  } catch {
    return false;
  }
}

async function migrateOldCredentials(): Promise<boolean> {
  const oldClientId = await getFromKeyring('client_id');
  const oldClientSecret = await getFromKeyring('client_secret');
  const oldTokens = await getFromKeyring('tokens');

  if (!oldClientId && !oldClientSecret && !oldTokens) {
    return false;
  }

  if (oldClientId) {
    await setInKeyring(profileKey('default', 'client_id'), oldClientId);
    await deleteFromKeyring('client_id');
  }
  if (oldClientSecret) {
    await setInKeyring(profileKey('default', 'client_secret'), oldClientSecret);
    await deleteFromKeyring('client_secret');
  }
  if (oldTokens) {
    await setInKeyring(profileKey('default', 'tokens'), oldTokens);
    await deleteFromKeyring('tokens');
  }

  if (!profileExists('default')) {
    addProfile('default');
  }

  return true;
}

export async function getClientCredentials(profile?: string): Promise<ClientCredentials | null> {
  const p = profile ?? getActiveProfile();
  validateProfileName(p);

  await migrateOldCredentials();

  const clientId =
    (await getFromKeyring(profileKey(p, 'client_id'))) ||
    (p === 'default' && (process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID)) ||
    null;
  const clientSecret =
    (await getFromKeyring(profileKey(p, 'client_secret'))) ||
    (p === 'default' && (process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET)) ||
    null;

  if (!clientId || !clientSecret) return null;
  return { client_id: clientId, client_secret: clientSecret };
}

export async function setClientCredentials(
  clientId: string,
  clientSecret: string,
  profile?: string
): Promise<void> {
  const p = profile ?? getActiveProfile();
  validateProfileName(p);
  await setInKeyring(profileKey(p, 'client_id'), clientId);
  await setInKeyring(profileKey(p, 'client_secret'), clientSecret);
}

export async function getTokens(profile?: string): Promise<Tokens | null> {
  const p = profile ?? getActiveProfile();
  validateProfileName(p);

  await migrateOldCredentials();

  // Only fall back to env vars for 'default' profile with no email configured
  // (i.e., user hasn't run auth login yet). Once email is set, use keyring only.
  const shouldFallbackToEnv = p === 'default' && !getProfileEmail(p);
  const tokensJson =
    (await getFromKeyring(profileKey(p, 'tokens'))) ||
    (shouldFallbackToEnv && (process.env.GOOGLE_TOKENS || process.env.GMAIL_TOKENS)) ||
    null;
  if (!tokensJson) return null;
  try {
    return JSON.parse(tokensJson);
  } catch {
    return null;
  }
}

export async function setTokens(tokens: Tokens, profile?: string): Promise<void> {
  const p = profile ?? getActiveProfile();
  validateProfileName(p);
  await setInKeyring(profileKey(p, 'tokens'), JSON.stringify(tokens));
}

export async function isAuthenticated(profile?: string): Promise<boolean> {
  const p = profile ?? getActiveProfile();
  const creds = await getClientCredentials(p);
  const tokens = await getTokens(p);
  return creds !== null && tokens !== null;
}

export async function logout(profile?: string): Promise<void> {
  const p = profile ?? getActiveProfile();
  validateProfileName(p);
  await deleteFromKeyring(profileKey(p, 'tokens'));
}

export async function deleteProfileCredentials(profile: string): Promise<void> {
  validateProfileName(profile);
  await deleteFromKeyring(profileKey(profile, 'client_id'));
  await deleteFromKeyring(profileKey(profile, 'client_secret'));
  await deleteFromKeyring(profileKey(profile, 'tokens'));
}

function createOAuth2Client(credentials: ClientCredentials) {
  return new google.auth.OAuth2(credentials.client_id, credentials.client_secret, REDIRECT_URI);
}

export async function getAuthenticatedClient(profile?: string) {
  const p = profile ?? getActiveProfile();
  const credentials = await getClientCredentials(p);
  if (!credentials) {
    throw new Error(`Profile '${p}' not authenticated. Run: google auth login --profile ${p}`);
  }

  const tokens = await getTokens(p);
  if (!tokens) {
    throw new Error(`No tokens found for profile '${p}'. Run: google auth login --profile ${p}`);
  }

  const oauth2Client = createOAuth2Client(credentials);
  oauth2Client.setCredentials(tokens);

  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      const existingTokens = await getTokens(p);
      const merged: Tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token ?? existingTokens?.refresh_token,
        expiry_date: newTokens.expiry_date ?? existingTokens?.expiry_date,
      };
      await setTokens(merged, p);
    }
  });

  return oauth2Client;
}

async function fetchUserEmail(oauth2Client: ReturnType<typeof createOAuth2Client>): Promise<string | null> {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const response = await oauth2.userinfo.get();
    return response.data.email ?? null;
  } catch {
    return null;
  }
}

export async function startAuthFlow(
  clientId: string,
  clientSecret: string,
  profile?: string
): Promise<void> {
  const p = profile ?? 'default';
  validateProfileName(p);

  await setClientCredentials(clientId, clientSecret, p);

  const oauth2Client = createOAuth2Client({ client_id: clientId, client_secret: clientSecret });

  authStateToken = randomBytes(32).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: authStateToken,
  });

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Authentication failed</h1><p>You can close this window.</p></body></html>'
        );
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (state !== authStateToken) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Invalid state parameter</h1><p>Security validation failed.</p></body></html>'
        );
        server.close();
        reject(new Error('CSRF validation failed: state parameter mismatch'));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Missing authorization code</h1></body></html>');
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens.access_token) {
          throw new Error('No access token received');
        }
        await setTokens(
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? undefined,
            expiry_date: tokens.expiry_date ?? undefined,
          },
          p
        );

        oauth2Client.setCredentials(tokens);
        const email = await fetchUserEmail(oauth2Client);

        addProfile(p, email ?? undefined);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          `<html><body><h1>Authentication successful!</h1><p>Profile '${p}' is now active.${email ? ` Logged in as ${email}.` : ''}</p><p>You can close this window and return to the terminal.</p></body></html>`
        );
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Token exchange failed</h1></body></html>');
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Opening browser for authentication...`);
      console.log(`If the browser doesn't open, visit: ${authUrl}`);
      open(authUrl);
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to start auth server: ${err.message}`));
    });
  });
}
