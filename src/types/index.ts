export interface MessageHeader {
  name: string;
  value: string;
}

export interface MessagePartBody {
  size: number;
  data?: string;
}

export interface MessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: MessageHeader[];
  body?: MessagePartBody;
  parts?: MessagePart[];
}

export interface Message {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: MessagePart;
  sizeEstimate?: number;
  raw?: string;
}

export interface MessageListItem {
  id: string;
  threadId: string;
}

export interface MessageList {
  messages?: MessageListItem[];
  resultSizeEstimate?: number;
}

export interface Draft {
  id: string;
  message: Message;
}

export interface DraftListItem {
  id: string;
  message: MessageListItem;
}

export interface DraftList {
  drafts?: DraftListItem[];
  resultSizeEstimate?: number;
}

export interface Label {
  id: string;
  name: string;
  type?: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  body?: string;
  labels?: string[];
}

export interface CreateDraftParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}
