import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';
import { getActiveProfile } from './config.js';
import type { CalendarListEntry, CalendarEvent, ParsedCalendarEvent } from '../types/index.js';

function getTimeZone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getDateInTimeZone(date: Date, timeZone: string): Date {
  // Convert date to the target timezone by parsing its locale string representation
  const localeString = date.toLocaleString('en-US', { timeZone });
  return new Date(localeString);
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

  private async fetchEventsFromCalendar(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults?: number,
    query?: string,
    timeZone?: string
  ): Promise<ParsedCalendarEvent[]> {
    const calendar = await this.getCalendar();
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      timeZone,
      maxResults: maxResults ?? 50,
      singleEvents: true,
      orderBy: 'startTime',
      q: query,
    });
    const events = response.data.items ?? [];
    // Filter out location markers and focus time blocks
    const filteredEvents = events.filter(
      (e) => e.eventType !== 'workingLocation' && e.eventType !== 'focusTime'
    );
    return filteredEvents.map(parseEvent);
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
      return this.fetchEventsFromCalendar(calendarId, timeMin, timeMax, maxResults, query, timeZone);
    }

    const calendars = await this.listCalendars();
    const selectedCalendars = calendars.filter((c) => c.selected);

    const allEvents = await Promise.all(
      selectedCalendars.map((c) =>
        this.fetchEventsFromCalendar(c.id!, timeMin, timeMax, maxResults, query, timeZone)
      )
    );

    return allEvents
      .flat()
      .sort((a, b) => {
        const aStart = a.start ?? '';
        const bStart = b.start ?? '';
        return aStart.localeCompare(bStart);
      });
  }

  async getEvent(eventId: string, calendarId = 'primary'): Promise<ParsedCalendarEvent> {
    const calendar = await this.getCalendar();
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });
    return parseEvent(response.data as CalendarEvent);
  }

  async getEventsToday(calendarId?: string): Promise<ParsedCalendarEvent[]> {
    const timeZone = getTimeZone();
    const nowInTz = getDateInTimeZone(new Date(), timeZone);
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
    const nowInTz = getDateInTimeZone(new Date(), timeZone);
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
    return this.fetchEvents(timeMin, timeMax, calendarId);
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
