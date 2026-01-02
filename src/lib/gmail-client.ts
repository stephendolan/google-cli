import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';
import { GoogleCliError } from './errors.js';
import type {
  Message,
  MessageList,
  Draft,
  DraftList,
  Label,
  ParsedMessage,
  CreateDraftParams,
} from '../types/index.js';

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getHeader(message: Message, name: string): string | undefined {
  const headers = message.payload?.headers ?? [];
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function extractTextBody(message: Message): string | undefined {
  const payload = message.payload;
  if (!payload) return undefined;

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
  }

  return undefined;
}

function parseMessage(message: Message): ParsedMessage {
  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(message, 'From'),
    to: getHeader(message, 'To'),
    subject: getHeader(message, 'Subject'),
    date: getHeader(message, 'Date'),
    snippet: message.snippet,
    body: extractTextBody(message),
    labels: message.labelIds,
  };
}

function validateEmailHeader(value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new GoogleCliError('Email header contains invalid newline characters');
  }
}

function createRawEmail(params: CreateDraftParams): string {
  validateEmailHeader(params.to);
  validateEmailHeader(params.subject);
  if (params.cc) validateEmailHeader(params.cc);
  if (params.bcc) validateEmailHeader(params.bcc);

  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=utf-8',
  ];

  if (params.cc) {
    lines.push(`Cc: ${params.cc}`);
  }
  if (params.bcc) {
    lines.push(`Bcc: ${params.bcc}`);
  }

  lines.push('', params.body);

  return encodeBase64Url(lines.join('\r\n'));
}

export class GmailClient {
  private gmail: ReturnType<typeof google.gmail> | null = null;

  private async getGmail() {
    if (this.gmail) return this.gmail;

    const auth = await getAuthenticatedClient();
    this.gmail = google.gmail({ version: 'v1', auth });
    return this.gmail;
  }

  async listMessages(
    options: {
      maxResults?: number;
      query?: string;
      labelIds?: string[];
    } = {}
  ): Promise<MessageList> {
    const gmail = await this.getGmail();
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: options.maxResults ?? 20,
      q: options.query,
      labelIds: options.labelIds,
    });
    return response.data as MessageList;
  }

  async getMessage(
    id: string,
    format: 'full' | 'metadata' | 'minimal' = 'full'
  ): Promise<ParsedMessage> {
    const gmail = await this.getGmail();
    const response = await gmail.users.messages.get({
      userId: 'me',
      id,
      format,
    });
    return parseMessage(response.data as Message);
  }

  async searchMessages(query: string, maxResults = 20): Promise<ParsedMessage[]> {
    const list = await this.listMessages({ query, maxResults });

    if (!list.messages || list.messages.length === 0) {
      return [];
    }

    return Promise.all(list.messages.map((m) => this.getMessage(m.id, 'full')));
  }

  async listLabels(): Promise<Label[]> {
    const gmail = await this.getGmail();
    const response = await gmail.users.labels.list({ userId: 'me' });
    return (response.data.labels ?? []) as Label[];
  }

  async listDrafts(maxResults = 20): Promise<DraftList> {
    const gmail = await this.getGmail();
    const response = await gmail.users.drafts.list({
      userId: 'me',
      maxResults,
    });
    return response.data as DraftList;
  }

  async getDraft(id: string): Promise<Draft> {
    const gmail = await this.getGmail();
    const response = await gmail.users.drafts.get({
      userId: 'me',
      id,
      format: 'full',
    });
    return response.data as Draft;
  }

  async createDraft(params: CreateDraftParams): Promise<Draft> {
    if (!params.to || !params.subject) {
      throw new GoogleCliError('Draft requires "to" and "subject" fields');
    }

    const gmail = await this.getGmail();
    const raw = createRawEmail(params);

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw },
      },
    });

    return response.data as Draft;
  }
}

export const gmailClient = new GmailClient();
