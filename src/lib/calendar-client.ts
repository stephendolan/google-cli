import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';
import { getActiveProfile } from './config.js';
import type { CalendarListEntry, CalendarEvent, ParsedCalendarEvent } from '../types/index.js';

function getTimeZone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function toTimeZone(date: Date, timeZone: string): Date {
  const localizedString = date.toLocaleString('en-US', { timeZone });
  return new Date(localizedString);
}

/**
 * Normalize a user-supplied range bound into an RFC3339 timestamp the Google
 * Calendar API accepts for timeMin/timeMax. A bare date (YYYY-MM-DD) is rejected
 * by the API, so expand it in the local timezone: a start bound becomes midnight
 * of that day, an end bound becomes midnight of the next day so the named day is
 * included. Inputs that already carry a time component pass through unchanged.
 */
export function normalizeRangeBound(input: string, bound: 'start' | 'end'): string {
  const trimmed = input.trim();
  if (trimmed.includes('T')) return trimmed;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid date "${input}". Use YYYY-MM-DD or a full ISO 8601 timestamp (e.g. 2026-04-01T00:00:00Z).`
    );
  }

  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(y, m - 1, d);
  // The Date constructor rolls overflow values over (2026-13-01 → 2027-01-01,
  // 2026-02-30 → 2026-03-02), which would silently query the wrong range. Reject
  // anything that didn't round-trip back to the input.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new Error(`Invalid date "${input}". Use a real calendar date in YYYY-MM-DD form.`);
  }
  if (bound === 'end') date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function parseEvent(event: CalendarEvent): ParsedCalendarEvent {
  if (!event.id) {
    throw new Error('Calendar event missing required id field');
  }

  const isAllDay = !event.start?.dateTime;
  const meetingLink = event.hangoutLink
    ? event.hangoutLink
    : event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri;

  return {
    id: event.id,
    summary: event.summary ?? undefined,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: event.start?.dateTime ?? event.start?.date ?? undefined,
    end: event.end?.dateTime ?? event.end?.date ?? undefined,
    isAllDay,
    status: event.status ?? undefined,
    htmlLink: event.htmlLink ?? undefined,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      name: a.displayName ?? undefined,
      status: a.responseStatus ?? undefined,
    })),
    meetingLink: meetingLink ?? undefined,
  };
}

export class CalendarClient {
  private calendar: ReturnType<typeof google.calendar> | null = null;
  private profile: string | undefined;

  constructor(profile?: string) {
    this.profile = profile;
  }

  private async getCalendar() {
    if (this.calendar) return this.calendar;

    const auth = await getAuthenticatedClient(this.profile);
    this.calendar = google.calendar({ version: 'v3', auth });
    return this.calendar;
  }

  async listCalendars(): Promise<CalendarListEntry[]> {
    const calendar = await this.getCalendar();
    const response = await calendar.calendarList.list();
    return (response.data.items ?? []) as CalendarListEntry[];
  }

  async resolveCalendarId(nameOrId: string): Promise<string> {
    const looksLikeCalendarId = nameOrId.includes('@');
    if (looksLikeCalendarId) {
      return nameOrId;
    }

    const calendars = await this.listCalendars();
    const query = nameOrId.toLowerCase();

    const exactMatch = calendars.find((c) => c.summary?.toLowerCase() === query);
    if (exactMatch?.id) return exactMatch.id;

    const prefixMatch = calendars.find((c) => c.summary?.toLowerCase().startsWith(query));
    if (prefixMatch?.id) return prefixMatch.id;

    const substringMatch = calendars.find((c) => c.summary?.toLowerCase().includes(query));
    if (substringMatch?.id) return substringMatch.id;

    const availableCalendars = calendars.map((c) => c.summary).join(', ');
    throw new Error(`Calendar "${nameOrId}" not found. Available calendars: ${availableCalendars}`);
  }

  private async fetchEventsFromCalendar(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults?: number,
    query?: string,
    timeZone?: string
  ): Promise<ParsedCalendarEvent[]> {
    const calendar = await this.getCalendar();
    const collected: ParsedCalendarEvent[] = [];
    let pageToken: string | undefined;

    // Without an explicit cap, page through the entire range so range queries
    // never silently truncate (the API returns at most 250 events per page).
    // A safety bound prevents an unbounded loop if the API misbehaves.
    for (let page = 0; page < 100; page++) {
      const pageSize =
        maxResults === undefined ? 250 : Math.min(maxResults - collected.length, 250);
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        timeZone,
        maxResults: pageSize,
        singleEvents: true,
        orderBy: 'startTime',
        q: query,
        pageToken,
      });

      const items = (response.data.items ?? []).filter(
        (e) => e.eventType !== 'workingLocation' && e.eventType !== 'focusTime'
      );
      collected.push(...items.map(parseEvent));

      pageToken = response.data.nextPageToken ?? undefined;
      if (!pageToken) break;
      if (maxResults !== undefined && collected.length >= maxResults) break;
    }

    // An unbounded query that exhausts the page cap with more pages pending is
    // truncated — surface it rather than silently returning a partial range.
    if (pageToken && maxResults === undefined) {
      console.error(
        `Warning: stopped at ${collected.length} events (page limit reached); range may be truncated. Narrow the date range for complete results.`
      );
    }

    return maxResults === undefined ? collected : collected.slice(0, maxResults);
  }

  private async fetchEvents(
    timeMin: string,
    timeMax: string,
    calendarId?: string,
    maxResults?: number,
    query?: string,
    timeZone?: string
  ): Promise<ParsedCalendarEvent[]> {
    if (calendarId) {
      const resolvedId = await this.resolveCalendarId(calendarId);
      return this.fetchEventsFromCalendar(resolvedId, timeMin, timeMax, maxResults, query, timeZone);
    }

    const calendars = await this.listCalendars();
    const selectedCalendars = calendars.filter((c) => c.selected);

    const allEvents = await Promise.all(
      selectedCalendars.map((c) =>
        this.fetchEventsFromCalendar(c.id!, timeMin, timeMax, maxResults, query, timeZone)
      )
    );

    const merged = allEvents.flat().sort((a, b) => {
      const aStart = a.start ?? '';
      const bStart = b.start ?? '';
      return aStart.localeCompare(bStart);
    });

    // Each calendar was capped individually; cap the merged result too so a
    // multi-calendar query still honors maxResults instead of returning N×cap.
    return maxResults === undefined ? merged : merged.slice(0, maxResults);
  }

  async getEvent(eventId: string, calendarId = 'primary'): Promise<ParsedCalendarEvent> {
    const calendar = await this.getCalendar();
    const resolvedId = await this.resolveCalendarId(calendarId);
    const response = await calendar.events.get({
      calendarId: resolvedId,
      eventId,
    });
    return parseEvent(response.data as CalendarEvent);
  }

  async getEventsToday(calendarId?: string): Promise<ParsedCalendarEvent[]> {
    const timeZone = getTimeZone();
    const nowInTz = toTimeZone(new Date(), timeZone);
    const startOfDay = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.fetchEvents(
      startOfDay.toISOString(),
      endOfDay.toISOString(),
      calendarId,
      undefined,
      undefined,
      timeZone
    );
  }

  async getEventsThisWeek(calendarId?: string): Promise<ParsedCalendarEvent[]> {
    const timeZone = getTimeZone();
    const nowInTz = toTimeZone(new Date(), timeZone);
    const startOfWeek = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate());
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return this.fetchEvents(
      startOfWeek.toISOString(),
      endOfWeek.toISOString(),
      calendarId,
      undefined,
      undefined,
      timeZone
    );
  }

  async getEventsInRange(
    timeMin: string,
    timeMax: string,
    calendarId?: string
  ): Promise<ParsedCalendarEvent[]> {
    return this.fetchEvents(
      normalizeRangeBound(timeMin, 'start'),
      normalizeRangeBound(timeMax, 'end'),
      calendarId
    );
  }

  async searchEvents(
    query: string,
    options: { calendarId?: string; maxResults?: number } = {}
  ): Promise<ParsedCalendarEvent[]> {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    return this.fetchEvents(
      now.toISOString(),
      oneYearFromNow.toISOString(),
      options.calendarId,
      options.maxResults,
      query
    );
  }
}

const clientCache = new Map<string, CalendarClient>();

export function getCalendarClient(profile?: string): CalendarClient {
  const p = profile ?? getActiveProfile();
  if (!clientCache.has(p)) {
    clientCache.set(p, new CalendarClient(p));
  }
  return clientCache.get(p)!;
}

// Backward compatibility: default client uses active profile
export const calendarClient = {
  listCalendars: () => getCalendarClient().listCalendars(),
  getEvent: (eventId: string, calendarId?: string) =>
    getCalendarClient().getEvent(eventId, calendarId),
  getEventsToday: (calendarId?: string) => getCalendarClient().getEventsToday(calendarId),
  getEventsThisWeek: (calendarId?: string) => getCalendarClient().getEventsThisWeek(calendarId),
  getEventsInRange: (timeMin: string, timeMax: string, calendarId?: string) =>
    getCalendarClient().getEventsInRange(timeMin, timeMax, calendarId),
  searchEvents: (query: string, options?: { calendarId?: string; maxResults?: number }) =>
    getCalendarClient().searchEvents(query, options),
};
