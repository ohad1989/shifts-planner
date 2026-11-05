// Run: npm run export:backup [out-file]
// Turns the desktop version's data/ folder into a backup file that the app
// can load with Settings → Backup → Import backup.
import fs from "node:fs";
import { makeBackup } from "../src/data/documents";
import { loadDocs } from "./load-data";

const out = process.argv[2] ?? `shift-planner-${new Date().toISOString().slice(0, 10)}.backup.json`;
const { docs, source } = loadDocs();
fs.writeFileSync(out, `${JSON.stringify(makeBackup(docs), null, 2)}\n`);
console.log(
  `Wrote ${out} from ${source}: ${docs.people.people.length} people, ${Object.keys(docs.weeks.weeks).length} weeks.`,
);
console.log("It holds real staff data: keep it out of git.");
