import { Command } from 'commander';
import { calendarClient } from '../lib/calendar-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createCalendarCommand(): Command {
  const calendar = new Command('calendar').description('Google Calendar operations');

  calendar
    .command('calendars')
    .description('List all calendars')
    .action(
      withErrorHandling(async () => {
        const calendars = await calendarClient.listCalendars();
        outputJson(calendars);
      })
    );

  calendar
    .command('today')
    .description("List today's events")
    .option('--calendar <id>', 'Calendar ID (default: primary)')
    .action(
      withErrorHandling(async (options) => {
        const events = await calendarClient.getEventsToday(options.calendar);
        outputJson(events);
      })
    );

  calendar
    .command('week')
    .description("List this week's events")
    .option('--calendar <id>', 'Calendar ID (default: primary)')
    .action(
      withErrorHandling(async (options) => {
        const events = await calendarClient.getEventsThisWeek(options.calendar);
        outputJson(events);
      })
    );

  calendar
    .command('list')
    .description('List events in a date range')
    .requiredOption('--from <date>', 'Start date (ISO 8601)')
    .requiredOption('--to <date>', 'End date (ISO 8601)')
    .option('--calendar <id>', 'Calendar ID (default: primary)')
    .action(
      withErrorHandling(async (options) => {
        const events = await calendarClient.getEventsInRange(
          options.from,
          options.to,
          options.calendar
        );
        outputJson(events);
      })
    );

  calendar
    .command('search <query>')
    .description('Search upcoming events')
    .option('--calendar <id>', 'Calendar ID (default: primary)')
    .option('--limit <n>', 'Maximum results', '50')
    .action(
      withErrorHandling(async (query: string, options) => {
        const events = await calendarClient.searchEvents(query, {
          calendarId: options.calendar,
          maxResults: Number(options.limit),
        });
        outputJson(events);
      })
    );

  calendar
    .command('event <id>')
    .description('Get a specific event by ID')
    .option('--calendar <id>', 'Calendar ID (default: primary)')
    .action(
      withErrorHandling(async (eventId: string, options) => {
        const event = await calendarClient.getEvent(eventId, options.calendar);
        outputJson(event);
      })
    );

  return calendar;
}
