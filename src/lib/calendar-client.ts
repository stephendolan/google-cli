import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';
import type { CalendarListEntry, CalendarEvent, ParsedCalendarEvent } from '../types/index.js';

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

  private async getCalendar() {
    if (this.calendar) return this.calendar;

    const auth = await getAuthenticatedClient();
    this.calendar = google.calendar({ version: 'v3', auth });
    return this.calendar;
  }

  async listCalendars(): Promise<CalendarListEntry[]> {
    const calendar = await this.getCalendar();
    const response = await calendar.calendarList.list();
    return (response.data.items ?? []) as CalendarListEntry[];
  }

  private async fetchEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults?: number,
    query?: string
  ): Promise<ParsedCalendarEvent[]> {
    const calendar = await this.getCalendar();
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults: maxResults ?? 50,
      singleEvents: true,
      orderBy: 'startTime',
      q: query,
    });
    return (response.data.items ?? []).map(parseEvent);
  }

  async getEvent(eventId: string, calendarId = 'primary'): Promise<ParsedCalendarEvent> {
    const calendar = await this.getCalendar();
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });
    return parseEvent(response.data as CalendarEvent);
  }

  async getEventsToday(calendarId = 'primary'): Promise<ParsedCalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.fetchEvents(calendarId, startOfDay.toISOString(), endOfDay.toISOString());
  }

  async getEventsThisWeek(calendarId = 'primary'): Promise<ParsedCalendarEvent[]> {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return this.fetchEvents(calendarId, startOfWeek.toISOString(), endOfWeek.toISOString());
  }

  async getEventsInRange(
    timeMin: string,
    timeMax: string,
    calendarId = 'primary'
  ): Promise<ParsedCalendarEvent[]> {
    return this.fetchEvents(calendarId, timeMin, timeMax);
  }

  async searchEvents(
    query: string,
    options: { calendarId?: string; maxResults?: number } = {}
  ): Promise<ParsedCalendarEvent[]> {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    return this.fetchEvents(
      options.calendarId ?? 'primary',
      now.toISOString(),
      oneYearFromNow.toISOString(),
      options.maxResults,
      query
    );
  }
}

export const calendarClient = new CalendarClient();
