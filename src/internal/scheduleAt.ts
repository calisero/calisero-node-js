/**
 * The API reads schedule_at as Romania time.
 */
export const SCHEDULE_TIMEZONE = 'Europe/Bucharest';

const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

/**
 * A date-time as the API wants it in schedule_at: `YYYY-MM-DD HH:MM:SS`, Romania
 * time. A string is passed as is; the API refuses any other format with a 422.
 *
 * @internal
 */
export function formatScheduleAt(scheduleAt: Date | string): string {
    if (typeof scheduleAt === 'string') {
        return scheduleAt;
    }

    if (!(scheduleAt instanceof Date) || Number.isNaN(scheduleAt.getTime())) {
        throw new RangeError('scheduleAt must be a valid Date or a "YYYY-MM-DD HH:MM:SS" string, Romania time.');
    }

    const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};

    for (const { type, value } of formatter.formatToParts(scheduleAt)) {
        parts[type] = value;
    }

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
