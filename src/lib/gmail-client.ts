import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';
import { getActiveProfile } from './config.js';
import { GoogleCliError } from './errors.js';
import type {
  Message,
  MessageList,
  MessagePart,
  MessageAttachment,
  Draft,
  DraftList,
  Label,
  ParsedMessage,
  CreateDraftParams,
} from '../types/index.js';

export function decodeBase64Url(data: string): Buffer {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
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
    return decodeBase64Url(payload.body.data).toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data).toString('utf-8');
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data).toString('utf-8');
      }
    }
  }

  return undefined;
}

function extractAttachments(payload: MessagePart | undefined): MessageAttachment[] {
  if (!payload) return [];

  const attachments: MessageAttachment[] = [];

  function traverse(part: MessagePart): void {
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        partId: part.partId ?? '',
        filename: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        size: part.body?.size ?? 0,
        attachmentId: part.body?.attachmentId,
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);
  return attachments;
}

function parseMessage(message: Message): ParsedMessage {
  const attachments = extractAttachments(message.payload);
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
    attachments: attachments.length > 0 ? attachments : undefined,
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
  private profile: string | undefined;

  constructor(profile?: string) {
    this.profile = profile;
  }

  private async getGmail() {
    if (this.gmail) return this.gmail;

    const auth = await getAuthenticatedClient(this.profile);
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

  async getAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<{ data: string; size: number }> {
    const gmail = await this.getGmail();
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    return {
      data: response.data.data ?? '',
      size: response.data.size ?? 0,
    };
  }
}

const clientCache = new Map<string, GmailClient>();

export function getGmailClient(profile?: string): GmailClient {
  const p = profile ?? getActiveProfile();
  if (!clientCache.has(p)) {
    clientCache.set(p, new GmailClient(p));
  }
  return clientCache.get(p)!;
}

// Backward compatibility: default client uses active profile
export const gmailClient = {
  listMessages: (options?: Parameters<GmailClient['listMessages']>[0]) =>
    getGmailClient().listMessages(options),
  getMessage: (id: string, format?: 'full' | 'metadata' | 'minimal') =>
    getGmailClient().getMessage(id, format),
  searchMessages: (query: string, maxResults?: number) =>
    getGmailClient().searchMessages(query, maxResults),
  listLabels: () => getGmailClient().listLabels(),
  listDrafts: (maxResults?: number) => getGmailClient().listDrafts(maxResults),
  getDraft: (id: string) => getGmailClient().getDraft(id),
  createDraft: (params: CreateDraftParams) => getGmailClient().createDraft(params),
  getAttachment: (messageId: string, attachmentId: string) =>
    getGmailClient().getAttachment(messageId, attachmentId),
};
