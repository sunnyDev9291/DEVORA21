/**
 * Quick checks for skills-term collect + bold parity (API-aligned rules).
 * Run: npx tsx scripts/verify-skill-terms-bold.ts
 */
import {
  boldSkillCategoryLabels,
  boldSkillTermsInText,
  collectSkillTermsFromSkillsBlock,
} from "../src/lib/resume-content-postprocess";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const skills = [
  "**Languages:** Python, C, R, Go, TypeScript",
  "**Methods:** A/B Testing, ETL | pipelines",
  "**Cloud:** AWS, GCP",
].join("\n");

const terms = collectSkillTermsFromSkillsBlock(skills);

assert(terms.includes("A/B Testing"), "must keep A/B Testing as one term");
assert(!terms.includes("A"), "must not create junk term A from A/B");
assert(terms.includes("C"), "must keep short tech C");
assert(terms.includes("R"), "must keep short tech R");
assert(terms.includes("Go"), "must keep Go");
assert(terms.includes("ETL | pipelines"), "must not split on |");
assert(!terms.some((t) => t === "ETL"), "must not split ETL | pipelines on |");

const bullet = boldSkillTermsInText(
  "Led A/B Testing for Digital checkout with Python and C",
  terms
);
assert(bullet.includes("**A/B Testing**"), "bold A/B Testing");
assert(bullet.includes("**Python**"), "bold Python");
assert(bullet.includes("**C**"), "bold C");
assert(!/\*\*Digital\*\*/.test(bullet), "must not bold Digital via git/partial");
assert(bullet.includes("Digital"), "Digital stays plain");

const title = boldSkillTermsInText("Senior Engineer | Python, AWS", terms);
assert(title.includes("**Python**"), "bold title term");
assert(title.includes("**AWS**"), "bold title AWS");

const labeled = boldSkillCategoryLabels(
  "Languages: **Python**, TypeScript\nBackend: Node.js"
);
assert(labeled.includes("**Languages:**"), "bold label");
assert(!labeled.includes("**Python**"), "do not bold skill values");
assert(labeled.includes("Python, TypeScript"), "values plain");

console.log("verify-skill-terms-bold: ok");
console.log("terms:", terms.join(" | "));
