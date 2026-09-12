// Shared appointment time formatting for reminder emails.
// Always renders in the IANA "Europe/Vienna" zone so DST/CET-CEST
// transitions are handled by the runtime instead of manual hour math.
const DEFAULT_LOCALE = "de-AT";
export const VIENNA_TIME_ZONE = "Europe/Vienna";

export function formatInViennaTime(value, options = {}) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(DEFAULT_LOCALE, {
    ...options,
    timeZone: VIENNA_TIME_ZONE,
  });
}
