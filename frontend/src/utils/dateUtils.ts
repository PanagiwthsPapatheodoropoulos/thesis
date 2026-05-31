/**
 * @filedateUtils.ts
 * @description Timezone-safe utilities for date parsing and formatting.
 */

/**
 * Parses an API timestamp safely as UTC if it doesn't specify a timezone.
 * Prevents the browser from interpreting server UTC times as local times,
 * which shifts display values by the client's timezone offset.
 * 
 * @param {string|Date|null|undefined} dateInput The raw timestamp input.
 * @returns {Date} Parsed JavaScript Date object.
 */
export const parseUTCDate = (dateInput: string | Date | null | undefined): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return new Date();

    // Check if the string matches an ISO 8601 or common database format with date and time
    // and DOES NOT already have a timezone offset specifier (like Z, +02:00, or -0500)
    const hasTime = trimmed.includes('T') || trimmed.includes(' ');
    const hasTimezone = trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed) || /[+-]\d{4}$/.test(trimmed);

    if (hasTime && !hasTimezone) {
      // Normalize space separator to T and append Z to mark it as UTC
      const normalized = trimmed.replace(' ', 'T') + 'Z';
      const parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date(trimmed);
  }

  return new Date(dateInput);
};

/**
 * Formats an API date/time string to a localized date and time representation.
 * 
 * @param {string|Date|null|undefined} dateString The timestamp.
 * @returns {string} Formatted localized string.
 */
export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  return parseUTCDate(dateString).toLocaleString();
};

/**
 * Returns a relative timezone-safe time string (e.g. "5m ago", "3h ago", "just now").
 * 
 * @param {string|Date|null|undefined} dateString The timestamp.
 * @returns {string} Relative time display string.
 */
export const getRelativeTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '';
  const now = new Date();
  const date = parseUTCDate(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // If the difference is negative or zero, count as just now
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};
