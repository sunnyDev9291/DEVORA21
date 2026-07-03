import fs from "fs";
import { parseProjectExperiencesFromDocxBuffer } from "../src/lib/resume-docx-project";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/verify-project-parse.ts <docx>");
  process.exit(1);
}

const buf = fs.readFileSync(path);
const { experiences } = parseProjectExperiencesFromDocxBuffer(buf);
experiences.forEach((e, i) => {
  console.log(`Job ${i + 1}: ${e.role}, ${e.company} — ${e.projects?.length ?? 0} projects`);
  e.projects?.forEach((p, j) => console.log(`  ${j + 1}. ${p.name}`));
});
