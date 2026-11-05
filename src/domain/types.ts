export type RestaurantId = "a" | "b";
export type Period = "morning" | "evening";
export type WeekdayLimit = "any" | "morning" | "evening" | "off";
export type WeekStatus = "draft" | "published";
export type RoleId = string;
export type DayMode = "both" | "morning" | "evening" | "closed";

/** Which periods run on a day; eveningStart overrides the template start (e.g. after Shabbat). */
export type WorkingDay = { mode: DayMode; eveningStart?: string };

export type Settings = {
  schemaVersion: number;
  weekStartsOn: number;
  hourCap: number;
  defaultNoDoubles: boolean;
  pdfFooter: string;
  roles: RoleId[];
  restaurants: { id: RestaurantId; name: string }[];
  /** Default plan per weekday, keyed "0" (Sun) … "6" (Sat). */
  workingDays?: Record<string, WorkingDay>;
  language?: Lang;
  theme?: Theme;
};

export type Lang = "en" | "he";
export type Theme = "system" | "light" | "dark";

export type Person = {
  id: string;
  name: string;
  homeRestaurantId: RestaurantId;
  roles: RoleId[];
  canCoverOther: boolean;
  active: boolean;
  noDoubles: boolean;
  maxDaysPerWeek: number | null;
  maxHoursPerWeek: number | null;
  maxConsecutiveDays: number | null;
  weekdayLimits: Record<string, WeekdayLimit>;
  unavailableDates: string[];
  notes: string;
  /** 1 = scheduled first … 5 = scheduled last. Missing → 3. */
  priority?: number;
};

export type SeatNeed = { role: RoleId; count: number };

export type PeriodTemplate = {
  start: string;
  end: string;
  seats: SeatNeed[];
};

export type Templates = {
  templates: Record<
    RestaurantId,
    { morning: PeriodTemplate; evening: PeriodTemplate }
  >;
};

export type Assignment = {
  id: string;
  restaurantId: RestaurantId;
  date: string;
  period: Period;
  role: RoleId;
  seatIndex: number;
  personId: string | null;
  override: boolean;
  overrideReason: string;
  /** Custom hours for whoever is on this seat; missing → the shift's usual times. */
  customStart?: string;
  customEnd?: string;
};

export type ArrangeReport = {
  at: string;
  scope: RestaurantId | "both";
  mode: "fill-open" | "replace-all";
  filled: number;
  leftOpen: number;
  atMaxDays: string[];
  unusedCover?: string[];
  opens?: { id: string; label: string; why: string }[];
};

export type PublishedSnapshot = { at: string; assignments: Assignment[] };

export type WeekRecord = {
  weekStart: string;
  status: Record<RestaurantId, WeekStatus>;
  assignments: Assignment[];
  lastArrangeReport: ArrangeReport | null;
  published?: Partial<Record<RestaurantId, PublishedSnapshot>>;
  /** This week's working days, keyed by ISO date. Missing → settings default. */
  days?: Record<string, WorkingDay>;
};

export type WeeksFile = {
  weeks: Record<string, WeekRecord>;
};

export type PeopleFile = { people: Person[] };

export type Store = {
  settings: Settings;
  people: Person[];
  templates: Templates;
  weeks: WeeksFile;
};
