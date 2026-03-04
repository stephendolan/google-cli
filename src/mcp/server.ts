import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getGmailClient } from '../lib/gmail-client.js';
import { getCalendarClient } from '../lib/calendar-client.js';
import { isAuthenticated } from '../lib/auth.js';
import {
  getActiveProfile,
  setActiveProfile,
  listProfiles,
  getProfileEmail,
  profileExists,
} from '../lib/config.js';

const server = new McpServer({
  name: 'google',
  version: '0.2.0',
});

type ToolResponse = { content: Array<{ type: 'text'; text: string }> };

const profileParam = z.string().optional().describe('Profile name (uses active profile if not specified)');

function jsonResponse(data: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResponse(error: unknown): ToolResponse {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return jsonResponse({ error: { name: 'mcp_error', detail } });
}

server.tool(
  'check_auth',
  'Check if Google CLI is authenticated',
  { profile: profileParam },
  async ({ profile }) => {
    try {
      const p = profile ?? getActiveProfile();
      const authenticated = await isAuthenticated(p);
      const email = getProfileEmail(p);
      return jsonResponse({ authenticated, profile: p, email: email ?? undefined });
    } catch (e) {
      return errorResponse(e);
    }
  }
);

// Profile management tools

server.tool('current_profile', 'Get the currently active profile', {}, async () => {
  try {
    const profile = getActiveProfile();
    const email = getProfileEmail(profile);
    const authenticated = await isAuthenticated(profile);
    return jsonResponse({ profile, email: email ?? undefined, authenticated });
  } catch (e) {
    return errorResponse(e);
  }
});

server.tool(
  'switch_profile',
  'Switch to a different profile (persists to config)',
  {
    profile: z.string().describe('Profile name to switch to'),
  },
  async ({ profile }) => {
    try {
      if (!profileExists(profile)) {
        return jsonResponse({ error: { name: 'profile_not_found', detail: `Profile '${profile}' not found` } });
      }
      setActiveProfile(profile);
      const email = getProfileEmail(profile);
      return jsonResponse({ switched: true, profile, email: email ?? undefined });
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool('list_profiles', 'List all configured profiles', {}, async () => {
  try {
    const profiles = listProfiles();
    const active = getActiveProfile();
    const result = await Promise.all(
      profiles.map(async (name) => ({
        name,
        email: getProfileEmail(name) ?? undefined,
        authenticated: await isAuthenticated(name),
        active: name === active,
      }))
    );
    return jsonResponse({ profiles: result, active });
  } catch (e) {
    return errorResponse(e);
  }
});

// Gmail tools

server.tool(
  'list_messages',
  'List message IDs from Gmail. Returns IDs only — use search_messages for full message content with boolean flags, or read_message for a single message.',
  {
    limit: z.number().optional().describe('Maximum number of messages (default: 20)'),
    query: z.string().optional().describe('Gmail search query'),
    label: z.string().optional().describe('Filter by label ID'),
    profile: profileParam,
  },
  async ({ limit, query, label, profile }) => {
    try {
      const result = await getGmailClient(profile).listMessages({
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
  'Read a single email by ID. Returns full message with boolean flags (isUnread, isInbox, isTrash, isSpam, isPromotions, isSocial).',
  {
    id: z.string().describe('Message ID'),
    profile: profileParam,
  },
  async ({ id, profile }) => {
    try {
      const message = await getGmailClient(profile).getMessage(id, 'full');
      return jsonResponse(message);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'search_messages',
  'Search Gmail messages. Returns full messages with boolean flags (isUnread, isInbox, isTrash, isSpam, isPromotions, isSocial). Inbox queries automatically exclude trash/spam.',
  {
    query: z.string().describe('Gmail search query (e.g., "from:user@example.com", "is:unread")'),
    limit: z.number().optional().describe('Maximum number of results (default: 20)'),
    profile: profileParam,
  },
  async ({ query, limit, profile }) => {
    try {
      const messages = await getGmailClient(profile).searchMessages(query, limit ?? 20);
      return jsonResponse(messages);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'list_labels',
  'List all Gmail labels',
  { profile: profileParam },
  async ({ profile }) => {
    try {
      const labels = await getGmailClient(profile).listLabels();
      return jsonResponse(labels);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'list_drafts',
  'List all draft emails',
  {
    limit: z.number().optional().describe('Maximum number of drafts (default: 20)'),
    profile: profileParam,
  },
  async ({ limit, profile }) => {
    try {
      const result = await getGmailClient(profile).listDrafts(limit ?? 20);
      return jsonResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'read_draft',
  'Read a specific draft by ID',
  {
    id: z.string().describe('Draft ID'),
    profile: profileParam,
  },
  async ({ id, profile }) => {
    try {
      const draft = await getGmailClient(profile).getDraft(id);
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
    profile: profileParam,
  },
  async ({ to, subject, body, cc, bcc, profile }) => {
    try {
      const draft = await getGmailClient(profile).createDraft({ to, subject, body, cc, bcc });
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
    profile: profileParam,
  },
  async ({ messageId, attachmentId, profile }) => {
    try {
      const attachment = await getGmailClient(profile).getAttachment(messageId, attachmentId);
      return jsonResponse(attachment);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

// Inbox tools

server.tool(
  'list_inbox',
  'List actionable inbox messages. Excludes promotions and social by default. Returns full messages with boolean flags.',
  {
    limit: z.number().optional().describe('Maximum number of messages (default: 20)'),
    includeRead: z.boolean().optional().describe('Include read messages (default: unread only)'),
    includePromotions: z.boolean().optional().describe('Include promotions category'),
    includeSocial: z.boolean().optional().describe('Include social category'),
    profile: profileParam,
  },
  async ({ limit, includeRead, includePromotions, includeSocial, profile }) => {
    try {
      const queryParts = ['in:inbox'];
      if (!includeRead) queryParts.push('is:unread');
      if (!includePromotions) queryParts.push('-category:promotions');
      if (!includeSocial) queryParts.push('-category:social');
      const messages = await getGmailClient(profile).searchMessages(queryParts.join(' '), limit ?? 20);
      return jsonResponse(messages);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'search_inbox',
  'Search within inbox messages. Query is auto-scoped to in:inbox.',
  {
    query: z.string().describe('Search query (automatically scoped to inbox)'),
    limit: z.number().optional().describe('Maximum number of results (default: 20)'),
    profile: profileParam,
  },
  async ({ query, limit, profile }) => {
    try {
      const messages = await getGmailClient(profile).searchMessages(`in:inbox ${query}`, limit ?? 20);
      return jsonResponse(messages);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

// Calendar tools

server.tool(
  'list_calendars',
  'List all Google calendars',
  { profile: profileParam },
  async ({ profile }) => {
    try {
      const calendars = await getCalendarClient(profile).listCalendars();
      return jsonResponse(calendars);
    } catch (e) {
      return errorResponse(e);
    }
  }
);

server.tool(
  'calendar_today',
  "Get today's calendar events",
  {
    calendarId: z.string().optional().describe('Calendar name or ID (default: all selected calendars)'),
    profile: profileParam,
  },
  async ({ calendarId, profile }) => {
    try {
      const events = await getCalendarClient(profile).getEventsToday(calendarId);
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
    calendarId: z.string().optional().describe('Calendar name or ID (default: all selected calendars)'),
    profile: profileParam,
  },
  async ({ calendarId, profile }) => {
    try {
      const events = await getCalendarClient(profile).getEventsThisWeek(calendarId);
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
    calendarId: z.string().optional().describe('Calendar name or ID (default: all selected calendars)'),
    profile: profileParam,
  },
  async ({ timeMin, timeMax, calendarId, profile }) => {
    try {
      const events = await getCalendarClient(profile).getEventsInRange(timeMin, timeMax, calendarId);
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
    calendarId: z.string().optional().describe('Calendar name or ID (default: all selected calendars)'),
    limit: z.number().optional().describe('Maximum results (default: 50)'),
    profile: profileParam,
  },
  async ({ query, calendarId, limit, profile }) => {
    try {
      const events = await getCalendarClient(profile).searchEvents(query, {
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
    calendarId: z.string().optional().describe('Calendar name or ID (default: primary)'),
    profile: profileParam,
  },
  async ({ eventId, calendarId, profile }) => {
    try {
      const event = await getCalendarClient(profile).getEvent(eventId, calendarId);
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
