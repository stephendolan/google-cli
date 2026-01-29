import { Command } from 'commander';
import { getCalendarClient } from '../lib/calendar-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';

function getProfile(cmd: Command): string | undefined {
  return cmd.parent?.parent?.opts()?.profile;
}

export function createCalendarCommand(): Command {
  const calendar = new Command('calendar').description('Google Calendar operations');

  calendar
    .command('calendars')
    .description('List all calendars')
    .action(
      withErrorHandling(async function (this: Command) {
        const client = getCalendarClient(getProfile(this));
        const calendars = await client.listCalendars();
        outputJson(calendars);
      })
    );

  calendar
    .command('today')
    .description("List today's events")
    .option('--calendar <id>', 'Calendar name or ID (default: all selected calendars)')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getCalendarClient(getProfile(this));
        const events = await client.getEventsToday(options.calendar);
        outputJson(events);
      })
    );

  calendar
    .command('week')
    .description("List this week's events")
    .option('--calendar <id>', 'Calendar name or ID (default: all selected calendars)')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getCalendarClient(getProfile(this));
        const events = await client.getEventsThisWeek(options.calendar);
        outputJson(events);
      })
    );

  calendar
    .command('list')
    .description('List events in a date range')
    .requiredOption('--from <date>', 'Start date (ISO 8601)')
    .requiredOption('--to <date>', 'End date (ISO 8601)')
    .option('--calendar <id>', 'Calendar name or ID (default: all selected calendars)')
    .action(
      withErrorHandling(async function (this: Command, options) {
        const client = getCalendarClient(getProfile(this));
        const events = await client.getEventsInRange(
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
    .option('--calendar <id>', 'Calendar name or ID (default: all selected calendars)')
    .option('--limit <n>', 'Maximum results', '50')
    .action(
      withErrorHandling(async function (this: Command, query: string, options) {
        const client = getCalendarClient(getProfile(this));
        const events = await client.searchEvents(query, {
          calendarId: options.calendar,
          maxResults: Number(options.limit),
        });
        outputJson(events);
      })
    );

  calendar
    .command('event <id>')
    .description('Get a specific event by ID')
    .option('--calendar <id>', 'Calendar name or ID (default: primary)')
    .action(
      withErrorHandling(async function (this: Command, eventId: string, options) {
        const client = getCalendarClient(getProfile(this));
        const event = await client.getEvent(eventId, options.calendar);
        outputJson(event);
      })
    );

  return calendar;
}
