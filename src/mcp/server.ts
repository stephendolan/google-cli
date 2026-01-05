import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { gmailClient } from '../lib/gmail-client.js';
import { calendarClient } from '../lib/calendar-client.js';
import { isAuthenticated } from '../lib/auth.js';

const server = new McpServer({
  name: 'google',
  version: '0.2.0',
});

type ToolResponse = { content: Array<{ type: 'text'; text: string }> };

function jsonResponse(data: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResponse(error: unknown): ToolResponse {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return jsonResponse({ error: { name: 'mcp_error', detail } });
}

server.tool('check_auth', 'Check if Google CLI is authenticated', {}, async () => {
  try {
    const authenticated = await isAuthenticated();
    return jsonResponse({ authenticated });
  } catch (e) {
    return errorResponse(e);
  }
});

server.tool(
  'list_messages',
  'List messages from Gmail inbox',
  {
    limit: z.number().optional().describe('Maximum number of messages (default: 20)'),
    query: z.string().optional().describe('Gmail search query'),
    label: z.string().optional().describe('Filter by label ID'),
  },
  async ({ limit, query, label }) => {
    try {
      const result = await gmailClient.listMessages({
        maxResults: limit ?? 20,
        query,
        labelIds: label ? [label] : undefined,
      });
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'read_message',
  'Read a specific email message by ID',
  { id: z.string().describe('Message ID') },
  async ({ id }) => {
    try {
      const message = await gmailClient.getMessage(id, 'full');
      return jsonResponse(message);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'search_messages',
  'Search messages using Gmail search syntax',
  {
    query: z.string().describe('Gmail search query (e.g., "from:user@example.com", "is:unread")'),
    limit: z.number().optional().describe('Maximum number of results (default: 20)'),
  },
  async ({ query, limit }) => {
    try {
      const messages = await gmailClient.searchMessages(query, limit ?? 20);
      return jsonResponse(messages);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool('list_labels', 'List all Gmail labels', {}, async () => {
  try {
    const labels = await gmailClient.listLabels();
    return jsonResponse(labels);
  } catch (e) {
    return errorResponse(e);
  }
});

server.tool(
  'list_drafts',
  'List all draft emails',
  { limit: z.number().optional().describe('Maximum number of drafts (default: 20)') },
  async ({ limit }) => {
    try {
      const result = await gmailClient.listDrafts(limit ?? 20);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'read_draft',
  'Read a specific draft by ID',
  { id: z.string().describe('Draft ID') },
  async ({ id }) => {
    try {
      const draft = await gmailClient.getDraft(id);
      return jsonResponse(draft);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'create_draft',
  'Create a new email draft (does NOT send)',
  {
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body text'),
    cc: z.string().optional().describe('CC recipients (comma-separated)'),
    bcc: z.string().optional().describe('BCC recipients (comma-separated)'),
  },
  async ({ to, subject, body, cc, bcc }) => {
    try {
      const draft = await gmailClient.createDraft({ to, subject, body, cc, bcc });
      return jsonResponse({ created: true, id: draft.id });
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'get_attachment',
  'Download an attachment from an email message',
  {
    messageId: z.string().describe('Message ID'),
    attachmentId: z.string().describe('Attachment ID (from message attachments list)'),
  },
  async ({ messageId, attachmentId }) => {
    try {
      const attachment = await gmailClient.getAttachment(messageId, attachmentId);
      return jsonResponse(attachment);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

// Calendar tools

server.tool('list_calendars', 'List all Google calendars', {}, async () => {
  try {
    const calendars = await calendarClient.listCalendars();
    return jsonResponse(calendars);
  } catch (e) {
    return errorResponse(e);
  }
});

server.tool(
  'calendar_today',
  "Get today's calendar events",
  {
    calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
  },
  async ({ calendarId }) => {
    try {
      const events = await calendarClient.getEventsToday(calendarId);
      return jsonResponse(events);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'calendar_week',
  "Get this week's calendar events",
  {
    calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
  },
  async ({ calendarId }) => {
    try {
      const events = await calendarClient.getEventsThisWeek(calendarId);
      return jsonResponse(events);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'calendar_events',
  'Get calendar events in a date range',
  {
    timeMin: z.string().describe('Start date/time (ISO 8601)'),
    timeMax: z.string().describe('End date/time (ISO 8601)'),
    calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
  },
  async ({ timeMin, timeMax, calendarId }) => {
    try {
      const events = await calendarClient.getEventsInRange(timeMin, timeMax, calendarId);
      return jsonResponse(events);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'calendar_search',
  'Search upcoming calendar events',
  {
    query: z.string().describe('Search query'),
    calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
    limit: z.number().optional().describe('Maximum results (default: 50)'),
  },
  async ({ query, calendarId, limit }) => {
    try {
      const events = await calendarClient.searchEvents(query, {
        calendarId,
        maxResults: limit,
      });
      return jsonResponse(events);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'calendar_event',
  'Get a specific calendar event by ID',
  {
    eventId: z.string().describe('Event ID'),
    calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
  },
  async ({ eventId, calendarId }) => {
    try {
      const event = await calendarClient.getEvent(eventId, calendarId);
      return jsonResponse(event);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

export async function runMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
