// Editorial time formatters. Roman numerals, day names, and relative-time
// phrasings tuned to the Ilya voice ("three days ago", not "3d ago").

const ROMAN_PAIRS: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  if (n <= 0) return 'I';
  if (n > 3999) n = 3999;
  let result = '';
  let remaining = Math.floor(n);
  for (const [value, numeral] of ROMAN_PAIRS) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

const MONTHS_LONG = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

const DAYS_LONG = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
  'THURSDAY', 'FRIDAY', 'SATURDAY',
];

// Returns "12 NOV" — the kicker date pattern.
export function formatKickerDate(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// Returns "THE TUESDAY, NOVEMBER 12, MMXXVI" — the masthead dateline.
export function formatMastheadDate(date: Date = new Date()): string {
  const dayName = DAYS_LONG[date.getDay()];
  const month = MONTHS_LONG[date.getMonth()];
  const day = date.getDate();
  const year = toRoman(date.getFullYear());
  return `THE ${dayName}, ${month} ${day}, ${year}`;
}

// Returns "HH:MM" — the editor's "FILED — at 14:32" stamp.
export function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Editorial relative time: "untouched since filing", "moments ago",
// "three days ago", "last month". Numbers under one hundred spelled out.
const NUM_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

function spell(n: number): string {
  if (n < NUM_WORDS.length) return NUM_WORDS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const tensWord = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'][tens];
    return ones ? `${tensWord}-${NUM_WORDS[ones]}` : tensWord;
  }
  return String(n);
}

export function relativeTime(ms: number | null | undefined): string {
  if (!ms) return 'untouched since filing';
  const diff = Date.now() - ms;
  if (diff < 0) return 'moments ago';

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);

  if (sec < 90) return 'moments ago';
  if (min < 60) return `${spell(min)} ${min === 1 ? 'minute' : 'minutes'} ago`;
  if (hr < 24) return `${spell(hr)} ${hr === 1 ? 'hour' : 'hours'} ago`;
  if (day === 1) return 'yesterday';
  if (day < 7) return `${spell(day)} days ago`;
  if (week === 1) return 'last week';
  if (day < 30) return `${spell(week)} weeks ago`;
  if (month === 1) return 'last month';
  if (day < 365) return `${spell(month)} months ago`;
  if (year === 1) return 'last year';
  return `${spell(year)} years ago`;
}

// Days between two ms timestamps, useful for the masthead "NO {sequence}".
export function daysSince(ms: number): number {
  const d = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  return Math.max(0, d);
}
