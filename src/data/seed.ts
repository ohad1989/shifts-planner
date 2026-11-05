import type { Docs } from './db';

// Starter documents for a fresh install. These are the empty example files,
// never real staff data.
export const SEED: Docs = {
  settings: require('../../data-example/settings.json'),
  people: require('../../data-example/people.json'),
  templates: require('../../data-example/templates.json'),
  weeks: require('../../data-example/weeks.json'),
};
