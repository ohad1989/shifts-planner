import { createContext, useContext } from "react";
import type { Lang, Period } from "./types";

/*
 * English text is the key. Hebrew comes from HE; anything missing falls back
 * to the English. {name}-style placeholders are filled from `vars`.
 */

const EN: Record<string, string> = {
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
};

const HE: Record<string, string> = {
  // app shell
  "Shift Planner": "סידור משמרות",
  Planner: "סידור",
  Publish: "פרסום",
  People: "עובדים",
  Settings: "הגדרות",
  "Saving…": "שומר…",
  "Saved {time}": "נשמר {time}",
  "All data on disk": "כל הנתונים שמורים",
  Language: "שפה",
  Theme: "ערכת צבעים",
  "Theme: {mode}": "ערכת צבעים: {mode}",
  "theme.system": "לפי המערכת",
  "theme.light": "בהירה",
  "theme.dark": "כהה",
  Dismiss: "סגור",
  Published: "פורסם",
  Draft: "טיוטה",
  "Previous week": "שבוע קודם",
  "Next week": "שבוע הבא",
  "This week": "השבוע",
  "Can't read the data files": "לא ניתן לקרוא את קובצי הנתונים",
  "Start the app with": "הפעילו את האפליקציה עם",
  "from the app folder so the local file service is running.": "מתיקיית האפליקציה כדי ששירות הקבצים המקומי יפעל.",
  Retry: "נסו שוב",
  "Loading…": "טוען…",
  Close: "סגירה",

  // planner
  "{n} assigned seat(s) on {day} will be removed. Continue?": "{n} משבצות מאוישות ב{day} יימחקו. להמשיך?",
  "{n} assigned seat(s) will be removed. Continue?": "{n} משבצות מאוישות יימחקו. להמשיך?",
  "both restaurants": "שתי המסעדות",
  "{names} is published for this week. Reopen it as a draft before arranging.":
    "{names} פורסם לשבוע הזה. פתחו אותו מחדש כטיוטה לפני סידור.",
  " and ": " ו",
  "seats filled at {name}": "משבצות מאוישות ב{name}",
  "Reopen both restaurants as drafts to change working days": "פתחו את שתי המסעדות כטיוטה כדי לשנות ימי עבודה",
  "Working days": "ימי עבודה",
  "Edit seats": "עריכת משבצות",
  "Arrange {name}": "סדר את {name}",
  "Arrange both restaurants": "סדר את שתי המסעדות",
  "This week is published for {name} — the grid is locked.": "השבוע פורסם עבור {name} — הטבלה נעולה.",
  "Reopen as draft": "פתח מחדש כטיוטה",
  Closed: "סגור",
  "PM from {time}": "ערב מ-{time}",
  "Override: {reason}": "חריגה: {reason}",
  Unknown: "לא ידוע",
  Open: "פנוי",
  "Remove this seat": "הסר משבצת",
  "+ seat": "+ משבצת",
  "same day": "באותו יום",
  AM: "בוקר",
  PM: "ערב",
  "Your staff covering there": "העובדים שלך שמחליפים שם",
  "Cover from other site": "מחליף מהסניף השני",
  Override: "חריגה",
  "Over hour cap": "מעל מכסת השעות",
  "Custom hours": "שעות מותאמות",
  "Last arrange": "סידור אחרון",
  "replace all": "החלפת הכול",
  "fill open only": "מילוי פנויים בלבד",
  Hide: "הסתר",
  filled: "אוישו",
  "left open": "נשארו פנויות",
  "at max days": "במקסימום ימים",
  "Why seats stayed open": "למה משבצות נשארו פנויות",
  "People at their max days": "עובדים שהגיעו למקסימום ימים",
  "Cover staff not used at the other site": "מחליפים שלא שובצו בסניף השני",
  "This week already has assignments": "בשבוע הזה כבר יש שיבוצים",
  "Replace all": "החלף הכול",
  "Fill open only": "מלא פנויים בלבד",
  Arranging: "מסדר את",
  "keeps every current assignment, including your edits, and only fills empty seats.":
    "שומר את כל השיבוצים הקיימים, כולל העריכות שלך, וממלא רק משבצות פנויות.",
  "clears this week's assignments at {where} and fills from scratch. Overrides and custom hours are removed too.":
    "מוחק את שיבוצי השבוע ב{where} וממלא מחדש. גם חריגות ושעות מותאמות נמחקות.",
  "Working days this week": "ימי העבודה השבוע",
  "Reset to usual week": "חזרה לשבוע הרגיל",
  Done: "סיום",
  "Applies to both restaurants for this week only. Closing a shift removes its seats; opening one adds the usual seats. The usual week is in Settings.":
    "חל על שתי המסעדות לשבוע הזה בלבד. סגירת משמרת מוחקת את המשבצות שלה; פתיחת משמרת מוסיפה את המשבצות הרגילות. השבוע הרגיל מוגדר בהגדרות.",
  "Add a seat · {day} {period}": "הוספת משבצת · {day} {period}",
  "Which role is this extra seat for?": "לאיזה תפקיד המשבצת הנוספת?",

  // seat dialog
  "Assign {name} anyway? This breaks:": "לשבץ את {name} בכל זאת? זה מפר:",
  "Reason (shown on the publish checklist)": "סיבה (תוצג ברשימת הבדיקה לפני פרסום)",
  "e.g. Agreed by phone, swap with Dani": "למשל: סוכם בטלפון, החלפה עם דני",
  Back: "חזרה",
  "Confirm override": "אשר חריגה",
  Currently: "כרגע",
  "Unknown person": "עובד לא ידוע",
  "Edit worker": "עריכת עובד",
  Unassign: "בטל שיבוץ",
  "Hours for {name}": "שעות עבור {name}",
  "Usual shift {time}": "משמרת רגילה {time}",
  Start: "התחלה",
  End: "סיום",
  "h this shift": "ש׳ במשמרת",
  "{h}h this week": "{h} ש׳ השבוע",
  "Back to usual hours": "חזרה לשעות הרגילות",
  "Save hours": "שמור שעות",
  "Filter by name…": "סינון לפי שם…",
  "Eligible ({n})": "מתאימים ({n})",
  "Nobody can take this seat without breaking a rule.": "אף אחד לא יכול לקחת את המשבצת בלי להפר כלל.",
  Cover: "מחליף",
  "{days} days · {hours}h": "{days} ימים · {hours} ש׳",
  "Not eligible ({n})": "לא מתאימים ({n})",
  "Override…": "חריגה…",
  "Hide {n} people without this role": "הסתר {n} עובדים בלי התפקיד",
  "Show {n} people without this role": "הצג {n} עובדים בלי התפקיד",

  // publish & exports
  "There are {n} conflicts. Publish anyway?": "יש {n} התנגשויות. לפרסם בכל זאת?",
  Conflicts: "התנגשויות",
  "Open seats": "משבצות פנויות",
  Overrides: "חריגות",
  "Hour warnings": "אזהרות שעות",
  "Checklist · {name}": "רשימת בדיקה · {name}",
  "Published {when}": "פורסם {when}",
  Republish: "פרסם מחדש",
  Share: "שיתוף",
  "Download PDF": "הורד PDF",
  "Download table (Excel)": "הורד טבלה (Excel)",
  "A table with the week's roster and hours per worker. Opens in Excel.": "טבלה עם סידור השבוע ושעות לכל עובד. נפתחת ב-Excel.",
  "Copied ✓": "הועתק ✓",
  "Copy WhatsApp text": "העתק טקסט לוואטסאפ",
  "This week is still a draft — the PDF will be marked DRAFT.": "השבוע עדיין טיוטה — ה-PDF יסומן DRAFT.",
  "The PDF is in English (its fonts can't show Hebrew).": "קובץ ה-PDF באנגלית (הגופנים שלו לא תומכים בעברית).",
  "no reason": "ללא סיבה",
  "unknown person": "עובד לא ידוע",
  "{name}: {h}h (cap {cap}h)": "{name}: {h} ש׳ (מכסה {cap} ש׳)",
  Shift: "משמרת",
  Role: "תפקיד",
  OPEN: "פנוי",
  "Hours at {name}": "שעות ב{name}",
  Worker: "עובד",
  Days: "ימים",
  Shifts: "משמרות",
  Hours: "שעות",
  "from {time}": "מ-{time}",

  // people
  Any: "הכול",
  "Mornings only": "רק בקרים",
  "Evenings only": "רק ערבים",
  Off: "חופש",
  mornings: "בקרים",
  evenings: "ערבים",
  "off {days}": "חופש {days}",
  "max {n}d": "עד {n} ימים",
  "doubles ok": "כפולות מותרות",
  "Discard unsaved changes to this person?": "לבטל שינויים שלא נשמרו לעובד הזה?",
  "Name is required.": "חובה למלא שם.",
  "Pick at least one role.": "בחרו לפחות תפקיד אחד.",
  "Delete {name}? They will be unassigned from every week. (Tip: marking them inactive keeps history.)":
    "למחוק את {name}? השיבוצים שלו יוסרו מכל השבועות. (טיפ: סימון כלא פעיל שומר את ההיסטוריה.)",
  "Delete {name}?": "למחוק את {name}?",
  "Search staff…": "חיפוש עובדים…",
  "+ Add": "+ הוספה",
  "{n} active": "{n} פעילים",
  "Select a person or add a new one.": "בחרו עובד או הוסיפו חדש.",
  "New person": "עובד חדש",
  Unnamed: "ללא שם",
  Cancel: "ביטול",
  Delete: "מחיקה",
  Save: "שמירה",
  "Full name": "שם מלא",
  "Home restaurant": "מסעדת בית",
  Roles: "תפקידים",
  Active: "פעיל",
  "Can cover {name}": "יכול להחליף ב{name}",
  "No double shifts (morning + evening same day)": "בלי משמרות כפולות (בוקר + ערב באותו יום)",
  "Max working days / week": "מקסימום ימי עבודה בשבוע",
  "No cap": "ללא הגבלה",
  "Max consecutive days": "מקסימום ימים רצופים",
  "Max hours / week (soft)": "מקסימום שעות בשבוע (גמיש)",
  "Default {n}": "ברירת מחדל {n}",
  "Time of day per weekday": "שעות לפי יום בשבוע",
  "One-off unavailable dates": "תאריכים חד-פעמיים שאינו זמין",
  "Remove {d}": "הסר {d}",
  "Add date": "הוסף תאריך",
  Notes: "הערות",
  Priority: "עדיפות",
  "1 · first choice": "1 · בחירה ראשונה",
  "2 · high": "2 · גבוהה",
  "3 · normal": "3 · רגילה",
  "4 · low": "4 · נמוכה",
  "5 · last choice": "5 · בחירה אחרונה",
  "Arrange gives shifts to higher-priority workers first (1 = first choice), up to their max days. Home staff still come before cover staff, and people under their hour cap before those over it.":
    "הסידור נותן משמרות קודם לעובדים בעדיפות גבוהה (1 = בחירה ראשונה), עד מקסימום הימים שלהם. עובדי הבית עדיין קודמים למחליפים, ומי שמתחת למכסת השעות קודם למי שמעליה.",

  // settings
  "{n} people have the {role} role. Remove it from them first.": "ל-{n} עובדים יש את התפקיד {role}. הסירו אותו מהם קודם.",
  "Staffing and working-day changes apply to weeks you haven't touched yet. Weeks already saved keep their seats — use “Edit seats” or “Working days” in the planner for those.":
    "שינויי איוש וימי עבודה חלים על שבועות שעוד לא נערכו. שבועות שכבר נשמרו שומרים על המשבצות שלהם — השתמשו ב„עריכת משבצות” או „ימי עבודה” בסידור.",
  Discard: "ביטול שינויים",
  "Save settings": "שמור הגדרות",
  Appearance: "תצוגה",
  "These apply right away.": "השינויים חלים מיד.",
  General: "כללי",
  "Restaurant {id} name": "שם מסעדה {id}",
  "Week starts on": "השבוע מתחיל ביום",
  "Default hour cap / week (soft)": "מכסת שעות שבועית ברירת מחדל (גמישה)",
  "New people: no double shifts by default": "עובדים חדשים: בלי משמרות כפולות כברירת מחדל",
  "PDF / WhatsApp footer (manager contact)": "שורת סיום ל-PDF / וואטסאפ (פרטי המנהל)",
  "The usual week. New weeks start from this; change a single week (a holiday, or when Shabbat ends later) with “Working days” in the Planner. Evening start blank = the restaurant's usual evening time.":
    "השבוע הרגיל. שבועות חדשים מתחילים ממנו; לשינוי שבוע בודד (חג, או כשהשבת יוצאת מאוחר) השתמשו ב„ימי עבודה” בסידור. שעת ערב ריקה = שעת הערב הרגילה של המסעדה.",
  "New role": "תפקיד חדש",
  "Add role": "הוסף תפקיד",
  "{name} · shifts and staffing": "{name} · משמרות ואיוש",
  Day: "יום",
  "Evening starts": "תחילת ערב",
  "Both shifts": "שתי המשמרות",
  "Morning only": "בוקר בלבד",
  "Evening only": "ערב בלבד",
  "Use the usual evening start ({time})": "שעת ערב רגילה ({time})",
  usual: "רגיל",
};

const PERIODS_HE: Record<Period, string> = { morning: "בוקר", evening: "ערב" };
const ROLES_HE: Record<string, string> = { bartender: "ברמן", grillman: "גרילמן", chef: "שף" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = (lang === "he" ? HE[key] : undefined) ?? EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function periodLabel(lang: Lang, p: Period): string {
  return lang === "he" ? PERIODS_HE[p] : cap(p);
}

export function roleLabel(lang: Lang, role: string): string {
  return lang === "he" ? (ROLES_HE[role] ?? role) : cap(role);
}

/** Keep a run of times/numbers left-to-right inside Hebrew text. */
export const ltr = (s: string) => `⁦${s}⁩`;

// Rule messages come from eligibility/arrange in English; rewrite them for Hebrew.
const REASONS_HE: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/Not assigned to this restaurant/g, () => "לא משויך למסעדה הזו"],
  [/Unavailable this date/g, () => "לא זמין בתאריך הזה"],
  [/Off this weekday/g, () => "חופש ביום הזה"],
  [/Mornings only this day/g, () => "רק בוקר ביום הזה"],
  [/Evenings only this day/g, () => "רק ערב ביום הזה"],
  [/Already on this period/g, () => "כבר משובץ במשמרת הזו"],
  [/Double shift blocked/g, () => "משמרת כפולה אסורה"],
  [/Already (\d+) days this week/g, (m) => `כבר ${m[1]} ימים השבוע`],
  [/Max (\d+) consecutive days/g, (m) => `מקסימום ${m[1]} ימים רצופים`],
  [/([\d.]+)h would exceed ([\d.]+)h cap/g, (m) => `${m[1]} ש׳ יחרגו ממכסה של ${m[2]} ש׳`],
  [/No active (\S+) who works at this restaurant/g, (m) => `אין ${roleLabel("he", m[1])} פעיל שעובד במסעדה הזו`],
  [/\((\d+(?:\/\d+)?) days, home only\)/g, (m) => `(${m[1]} ימים, רק במסעדת הבית)`],
  [/Not a (\w+)/g, (m) => `לא ${roleLabel("he", m[1])}`],
  [/\bInactive\b/g, () => "לא פעיל"],
  [/: available\b/g, () => ": זמין"],
];

export function translateReason(lang: Lang, s: string): string {
  if (lang !== "he") return s;
  let out = s;
  for (const [re, fn] of REASONS_HE) out = out.replace(re, (...args) => fn(args as unknown as RegExpMatchArray));
  return out;
}

export const I18nContext = createContext<Lang>("en");

export function useI18n() {
  const lang = useContext(I18nContext);
  return {
    lang,
    t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    role: (r: string) => roleLabel(lang, r),
    period: (p: Period) => periodLabel(lang, p),
    reason: (s: string) => translateReason(lang, s),
  };
}
