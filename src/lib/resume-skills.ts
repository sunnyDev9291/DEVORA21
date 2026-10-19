/**
 * Canonical resume skills shape (Mode-1 AI JSON).
 * Legacy newline "Category: a, b" strings are normalized into this map.
 */

export type ResumeSkillsMap = Record<string, string[]>;

function stripBold(value: string): string {
  return value.replace(/\*\*/g, "").trim();
}

function normalizeCategoryKey(raw: string): string {
  return stripBold(raw).replace(/:$/, "").trim();
}

function normalizeSkillItems(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      const token = stripBold(String(item ?? ""));
      if (!token) continue;
      if (!out.some((existing) => existing.toLowerCase() === token.toLowerCase())) {
        out.push(token);
      }
    }
    return out;
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,;]/)
      .map((part) => stripBold(part.replace(/^[-•]+\s*/, "")))
      .filter(Boolean);
  }
  return [];
}

/** Parse legacy "Category: a, b" / "**Category:** a, b" multiline skills. */
export function parseSkillsStringToMap(skills: string): ResumeSkillsMap {
  const map: ResumeSkillsMap = {};
  const lines = skills.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let untitledIndex = 0;

  for (const line of lines) {
    const markdown = line.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
    const boldLabel = line.match(/^\*\*([^*]+)\*\*\s*:\s*(.*)$/);
    const plain = line.match(/^([^:]+):\s*(.*)$/);
    const match = markdown || boldLabel || plain;
    if (match) {
      const key = normalizeCategoryKey(match[1]);
      const items = normalizeSkillItems(match[2]);
      if (key) {
        map[key] = [...(map[key] ?? []), ...items].filter(
          (item, index, all) =>
            all.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index
        );
        continue;
      }
    }
    untitledIndex += 1;
    const key = untitledIndex === 1 ? "Skills" : `Skills ${untitledIndex}`;
    map[key] = normalizeSkillItems(line);
  }

  return map;
}

/** Normalize AI / API / legacy skills into a map. */
export function normalizeResumeSkills(raw: unknown): ResumeSkillsMap {
  if (!raw) return {};

  if (typeof raw === "string") {
    return parseSkillsStringToMap(raw);
  }

  if (Array.isArray(raw)) {
    // Flat list → single "Skills" category
    const items = normalizeSkillItems(raw);
    return items.length ? { Skills: items } : {};
  }

  if (typeof raw === "object") {
    const map: ResumeSkillsMap = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const category = normalizeCategoryKey(key);
      if (!category) continue;
      const items = normalizeSkillItems(value);
      if (!items.length) {
        map[category] = [];
        continue;
      }
      map[category] = items;
    }
    return map;
  }

  return {};
}

export function isResumeSkillsEmpty(skills: ResumeSkillsMap | string | null | undefined): boolean {
  const map = typeof skills === "string" ? parseSkillsStringToMap(skills) : skills ?? {};
  return Object.values(map).every((items) => !items?.length);
}

export function countResumeSkillCategories(skills: ResumeSkillsMap): number {
  return Object.keys(skills).filter((key) => key.trim()).length;
}

export function countResumeSkillItems(skills: ResumeSkillsMap): number {
  return Object.values(skills).reduce((sum, items) => sum + (items?.length ?? 0), 0);
}

/** Legacy multiline display / DOCX-oriented string. */
export function skillsMapToDisplayString(skills: ResumeSkillsMap): string {
  return Object.entries(skills)
    .map(([category, items]) => {
      const value = (items ?? []).join(", ");
      return value ? `**${category}:** ${value}` : `**${category}:**`;
    })
    .join("\n");
}

/** Edit helper: display string → map. */
export function skillsDisplayStringToMap(text: string): ResumeSkillsMap {
  return parseSkillsStringToMap(text);
}

export function flattenResumeSkillTerms(skills: ResumeSkillsMap): string[] {
  const terms = new Set<string>();
  for (const items of Object.values(skills)) {
    for (const item of items ?? []) {
      const token = stripBold(item);
      if (token) terms.add(token);
    }
  }
  return Array.from(terms).sort((a, b) => b.length - a.length);
}

export function resumeSkillsEqual(a: ResumeSkillsMap, b: ResumeSkillsMap): boolean {
  return skillsMapToDisplayString(a) === skillsMapToDisplayString(b);
}
