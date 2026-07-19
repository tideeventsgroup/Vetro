// Welfare check-in cadence for lone workers on higher-risk shifts: any
// overnight shift, plus weekend day shifts (a site typically runs thinner
// cover on a Saturday/Sunday day than a weekday). Ordinary weekday day
// shifts are excluded — hourly check-ins on every shift would just be noise
// nobody acts on.
export const CHECK_CALL_INTERVAL_MS = 60 * 60 * 1000;

// How late a check-in can run before it's treated as missed rather than
// just due — mirrors jobs/checkNoShows.ts's own grace period.
export const CHECK_CALL_GRACE_MS = 30 * 60 * 1000;

// A shift is a "nightshift" if it starts in the evening or runs into the
// early morning. Uses the Lambda's local time (UTC in production) same as
// the rest of the app's date handling — not DST-adjusted for the UK, which
// is a pre-existing simplification here, not new to this feature.
function isNightShift(startTime: Date): boolean {
  const hour = startTime.getHours();
  return hour >= 20 || hour < 6;
}

function isWeekend(startTime: Date): boolean {
  const day = startTime.getDay();
  return day === 0 || day === 6;
}

export function shiftRequiresCheckCalls(startTime: Date): boolean {
  return isNightShift(startTime) || isWeekend(startTime);
}
