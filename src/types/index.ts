export interface MessageHeader {
  name: string;
  value: string;
}

export interface MessagePartBody {
  size: number;
  data?: string;
  attachmentId?: string;
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

export interface MessageAttachment {
  partId: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
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
  attachments?: MessageAttachment[];
}

export interface CreateDraftParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

// Calendar types

export interface CalendarListEntry {
  id?: string | null;
  summary: string;
  description?: string | null;
  primary?: boolean | null;
  selected?: boolean | null;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  accessRole?: string | null;
  timeZone?: string | null;
}

export interface CalendarEventDateTime {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
}

export interface CalendarEventAttendee {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
  self?: boolean | null;
  organizer?: boolean | null;
}

export interface CalendarEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: CalendarEventDateTime;
  end?: CalendarEventDateTime;
  status?: string | null;
  eventType?: string | null;
  htmlLink?: string | null;
  created?: string | null;
  updated?: string | null;
  creator?: { email?: string | null; displayName?: string | null } | null;
  organizer?: { email?: string | null; displayName?: string | null } | null;
  attendees?: CalendarEventAttendee[];
  recurringEventId?: string | null;
  hangoutLink?: string | null;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }>;
  } | null;
}

export interface ParsedCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  isAllDay: boolean;
  status?: string;
  htmlLink?: string;
  attendees?: Array<{ email?: string | null; name?: string; status?: string }>;
  meetingLink?: string;
}
