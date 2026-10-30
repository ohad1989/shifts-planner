import type {
  PeopleFile,
  Settings,
  Templates,
  WeeksFile,
} from "./types";

async function load<T>(name: string): Promise<T> {
  const res = await fetch(`/api/data/${name}`);
  if (!res.ok) throw new Error(`Failed to load ${name}`);
  return res.json() as Promise<T>;
}

async function save(name: string, data: unknown): Promise<void> {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  const res = await fetch(`/api/data/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Failed to save ${name}`);
}

export const api = {
  settings: {
    get: () => load<Settings>("settings.json"),
    put: (data: Settings) => save("settings.json", data),
  },
  people: {
    get: () => load<PeopleFile>("people.json"),
    put: (data: PeopleFile) => save("people.json", data),
  },
  templates: {
    get: () => load<Templates>("templates.json"),
    put: (data: Templates) => save("templates.json", data),
  },
  weeks: {
    get: () => load<WeeksFile>("weeks.json"),
    put: (data: WeeksFile) => save("weeks.json", data),
  },
};
