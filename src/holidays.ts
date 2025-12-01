/**
 * US Federal Holiday Detection
 *
 * Computes federal holidays dynamically for any given year.
 * Also flags the day after Thanksgiving and adjacent weekdays for long weekends.
 */

interface Holiday {
  date: Date;
  name: string;
}

/**
 * Get the nth occurrence of a specific weekday in a month
 * @param year - The year
 * @param month - The month (0-11)
 * @param weekday - The day of week (0=Sunday, 6=Saturday)
 * @param n - Which occurrence (1st, 2nd, etc.) or -1 for last
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  if (n === -1) {
    // Last occurrence of the weekday
    const lastDay = new Date(year, month + 1, 0);
    const diff = (lastDay.getDay() - weekday + 7) % 7;
    return new Date(year, month, lastDay.getDate() - diff);
  }

  const firstDay = new Date(year, month, 1);
  const firstOccurrence = 1 + ((weekday - firstDay.getDay() + 7) % 7);
  const date = firstOccurrence + (n - 1) * 7;
  return new Date(year, month, date);
}

/**
 * Get all federal holidays for a given year
 */
function getFederalHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];

  // New Year's Day - January 1
  holidays.push({ date: new Date(year, 0, 1), name: "New Year's Day" });

  // MLK Day - 3rd Monday of January
  holidays.push({ date: getNthWeekdayOfMonth(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' });

  // Presidents Day - 3rd Monday of February
  holidays.push({ date: getNthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day" });

  // Memorial Day - Last Monday of May
  holidays.push({ date: getNthWeekdayOfMonth(year, 4, 1, -1), name: 'Memorial Day' });

  // Independence Day - July 4
  holidays.push({ date: new Date(year, 6, 4), name: 'Independence Day' });

  // Labor Day - 1st Monday of September
  holidays.push({ date: getNthWeekdayOfMonth(year, 8, 1, 1), name: 'Labor Day' });

  // Columbus Day - 2nd Monday of October
  holidays.push({ date: getNthWeekdayOfMonth(year, 9, 1, 2), name: 'Columbus Day' });

  // Veterans Day - November 11
  holidays.push({ date: new Date(year, 10, 11), name: 'Veterans Day' });

  // Thanksgiving - 4th Thursday of November
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
  holidays.push({ date: thanksgiving, name: 'Thanksgiving Day' });

  // Day after Thanksgiving
  holidays.push({
    date: new Date(year, 10, thanksgiving.getDate() + 1),
    name: 'Day after Thanksgiving',
  });

  // Christmas Day - December 25
  holidays.push({ date: new Date(year, 11, 25), name: 'Christmas Day' });

  return holidays;
}

/**
 * Get observed holiday date (accounts for weekends)
 * If holiday falls on Saturday, observed on Friday
 * If holiday falls on Sunday, observed on Monday
 */
function getObservedDate(holiday: Date): Date {
  const dayOfWeek = holiday.getDay();
  if (dayOfWeek === 6) {
    // Saturday -> Friday
    return new Date(holiday.getFullYear(), holiday.getMonth(), holiday.getDate() - 1);
  }
  if (dayOfWeek === 0) {
    // Sunday -> Monday
    return new Date(holiday.getFullYear(), holiday.getMonth(), holiday.getDate() + 1);
  }
  return holiday;
}

/**
 * Get all holiday-related dates for a year (including observed dates and long weekend days)
 */
function getAllHolidayDates(year: number): Set<string> {
  const holidayDates = new Set<string>();
  const holidays = getFederalHolidays(year);

  for (const holiday of holidays) {
    // Add the actual holiday date
    holidayDates.add(formatDateKey(holiday.date));

    // Add the observed date if different
    const observed = getObservedDate(holiday.date);
    holidayDates.add(formatDateKey(observed));

    // For Monday holidays, also flag the preceding Friday (long weekend)
    if (holiday.date.getDay() === 1) {
      const friday = new Date(holiday.date);
      friday.setDate(friday.getDate() - 3);
      holidayDates.add(formatDateKey(friday));
    }

    // For Friday holidays (like day after Thanksgiving), flag the weekend
    if (holiday.date.getDay() === 5) {
      // Saturday and Sunday are already weekends, but include them
      const saturday = new Date(holiday.date);
      saturday.setDate(saturday.getDate() + 1);
      holidayDates.add(formatDateKey(saturday));
    }
  }

  return holidayDates;
}

/**
 * Format a date as YYYY-MM-DD for comparison
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a given date is a holiday or holiday-adjacent day
 * @param date - The date to check (in local timezone)
 * @returns true if the date is a holiday or holiday-adjacent
 */
export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidayDates = getAllHolidayDates(year);
  const dateKey = formatDateKey(date);
  return holidayDates.has(dateKey);
}
