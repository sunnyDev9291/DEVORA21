/** Canonical tech/skill ontology for JD keyword detection (Franco-style ATS). */
export const TECH_ONTOLOGY = [
  "JavaScript",
  "TypeScript",
  "Node.js",
  "React",
  "Next.js",
  "Redux",
  "Vue",
  "Angular",
  "HTML",
  "CSS",
  "Tailwind",
  "Python",
  "Java",
  "C#",
  "Go",
  "Rust",
  "Spring Boot",
  "Django",
  "FastAPI",
  "Express",
  "MySQL",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "CI/CD",
  "Jenkins",
  "GitHub Actions",
  "GraphQL",
  "REST API",
  "gRPC",
  "Microservices",
  "Kafka",
  "RabbitMQ",
  "Git",
  "GitHub",
  "GitLab",
  "Jira",
  "Linux",
  "Agile",
  "Scrum",
  "Prometheus",
  "Grafana",
  "Jest",
  "Cypress",
  "Playwright",
  "SQL",
  "NoSQL",
  "Lambda",
  "EC2",
  "S3",
  "Machine Learning",
  "AI",
  "LLM",
  "OpenAI",
  "TensorFlow",
  "PyTorch",
  "Spark",
  "Hadoop",
  "Snowflake",
  "Databricks",
  "Figma",
  "Webpack",
  "Vite",
  "NestJS",
  "Flask",
  "Ruby",
  "Rails",
  "PHP",
  "Laravel",
  "Swift",
  "Kotlin",
  "Flutter",
  "React Native",
  "iOS",
  "Android",
  "DevOps",
  "SRE",
  "TDD",
  "OAuth",
  "JWT",
  "OAuth2",
  "WebSocket",
  "Socket.io",
  "Apollo",
  "Prisma",
  "Sequelize",
  "TypeORM",
  "Hibernate",
  ".NET",
  "ASP.NET",
  "Blazor",
  "WordPress",
  "Shopify",
  "Salesforce",
  "SAP",
  "Oracle",
  "DB2",
  "Cassandra",
  "DynamoDB",
  "Firebase",
  "Supabase",
  "Vercel",
  "Netlify",
  "Heroku",
  "Nginx",
  "Apache",
  "Puppeteer",
  "Selenium",
  "Postman",
  "Swagger",
  "OpenAPI",
  "Microservice",
  "Event-driven",
  "Serverless",
  "CloudFormation",
  "Helm",
  "Ansible",
  "Chef",
  "Puppet",
  "CircleCI",
  "Travis CI",
  "Bitbucket",
  "Confluence",
  "Notion",
  "Slack",
  "Datadog",
  "New Relic",
  "Sentry",
  "Splunk",
  "ELK",
  "Kibana",
  "Logstash",
  "Airflow",
  "dbt",
  "Power BI",
  "Tableau",
  "Looker",
  "BigQuery",
  "Redshift",
  "Athena",
  "Glue",
  "Step Functions",
  "SQS",
  "SNS",
  "CloudFront",
  "Route 53",
  "VPC",
  "IAM",
  "RBAC",
  "SSO",
  "SAML",
  "HIPAA",
  "PCI",
  "SOC 2",
  "GDPR",
  "PCI-DSS",
] as const;

export type JobKeywords = {
  mustHave: string[];
  niceToHave: string[];
  roleKeywords: string[];
  responsibilities: string[];
};

const KEYWORD_EXTRACT_PROMPT = `You extract ATS keywords from a job posting for strict resume matching.
Return ONLY valid json:
{
  "mustHave": ["string"],
  "niceToHave": ["string"],
  "roleKeywords": ["string"],
  "responsibilities": ["string"]
}

Rules:
- mustHave: required skills, languages, frameworks, tools, cloud platforms (max 20). From "required", "must have", "qualifications" sections or clearly mandatory context.
- niceToHave: preferred/bonus skills (max 15).
- roleKeywords: seniority + role + domain terms from job title (max 8).
- responsibilities: key duty phrases from JD (max 10, short noun phrases).
- Only concrete tech/domain terms — no soft skills like "communication".
- Normalize: "Node" → "Node.js", "Amazon Web Services" → "AWS", "K8s" → "Kubernetes".
- No markdown fences.`;

export function normalizeKeyword(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build alternates for matching (node.js → node, etc.) */
export function keywordVariants(keyword: string): string[] {
  const k = normalizeKeyword(keyword);
  const lower = k.toLowerCase();
  const variants = new Set<string>([lower]);

  const aliases: Record<string, string[]> = {
    "node.js": ["node", "nodejs"],
    "javascript": ["js"],
    "typescript": ["ts"],
    "kubernetes": ["k8s"],
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp", "google cloud"],
    "microsoft azure": ["azure"],
    "ci/cd": ["cicd", "ci cd"],
    "rest api": ["rest", "restful"],
    "graphql": ["gql"],
    "postgresql": ["postgres"],
    "mongodb": ["mongo"],
    "microservices": ["microservice"],
    "github actions": ["gh actions"],
    ".net": ["dotnet", "dot net"],
    "c#": ["csharp", "c sharp"],
    "machine learning": ["ml"],
    "artificial intelligence": ["ai"],
  };

  for (const [canonical, alts] of Object.entries(aliases)) {
    if (lower === canonical || alts.includes(lower)) {
      variants.add(canonical);
      alts.forEach((a) => variants.add(a));
    }
  }

  if (lower.includes(".")) variants.add(lower.replace(/\./g, ""));
  return [...variants];
}

export function keywordPresentInText(keyword: string, haystack: string): boolean {
  const normalized = normalizeForMatch(haystack);
  return keywordVariants(keyword).some((variant) => {
    if (variant.length <= 2) {
      return new RegExp(`\\b${escapeRegex(variant)}\\b`, "i").test(normalized);
    }
    return normalized.includes(variant);
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueKeywords(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = normalizeKeyword(item);
    if (!k || k.length < 2) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function extractOntologyFromText(text: string): string[] {
  const found: string[] = [];
  for (const term of TECH_ONTOLOGY) {
    if (keywordPresentInText(term, text)) found.push(term);
  }
  return found;
}

function extractSection(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractHeuristicKeywords(jobTitle: string, jobDescription: string, companyName: string): JobKeywords {
  const jd = jobDescription || jobTitle;
  const lower = jd.toLowerCase();

  const mustSection = extractSection(jd, [
    /(?:must[\s-]*have|required(?:\s+skills?)?|minimum\s+qualifications?|requirements?)\s*:?\s*([\s\S]{0,2000}?)(?=\n\s*(?:nice|preferred|bonus|responsibilities|about|qualifications|$))/i,
    /(?:qualifications?\s*(?:&|and)\s*requirements?)\s*:?\s*([\s\S]{0,2000}?)(?=\n\s*(?:nice|preferred|responsibilities|$))/i,
  ]);

  const niceSection = extractSection(jd, [
    /(?:nice[\s-]*to[\s-]*have|preferred(?:\s+skills?)?|bonus|plus)\s*:?\s*([\s\S]{0,1500}?)(?=\n\s*(?:responsibilities|requirements|about|$))/i,
  ]);

  const respSection = extractSection(jd, [
    /(?:responsibilities|what you['']ll do|you will)\s*:?\s*([\s\S]{0,2500}?)(?=\n\s*(?:requirements|qualifications|nice|about|$))/i,
  ]);

  const mustFromSection = extractOntologyFromText(mustSection);
  const niceFromSection = extractOntologyFromText(niceSection);
  const allFromJd = extractOntologyFromText(jd);

  let mustHave = mustFromSection.length > 0 ? mustFromSection : allFromJd.slice(0, 12);
  let niceToHave = niceFromSection.length > 0 ? niceFromSection : allFromJd.slice(12, 22);

  if (mustHave.length === 0 && allFromJd.length > 0) {
    mustHave = allFromJd.slice(0, Math.min(8, allFromJd.length));
    niceToHave = allFromJd.slice(mustHave.length, mustHave.length + 8);
  }

  const roleKeywords = uniqueKeywords([
    ...jobTitle.split(/[\s|,/]+/),
    ...(companyName.split(/[\s|,/]+/)),
    ...(lower.includes("senior") ? ["Senior"] : []),
    ...(lower.includes("staff") ? ["Staff"] : []),
    ...(lower.includes("lead") ? ["Lead"] : []),
    ...(lower.includes("principal") ? ["Principal"] : []),
    ...(lower.includes("junior") ? ["Junior"] : []),
  ]).filter((k) => k.length > 2);

  const responsibilities = respSection
    .split(/\n|•|·|–|-(?=\s)/)
    .map((l) => l.replace(/^[\d.)\s]+/, "").trim())
    .filter((l) => l.length > 15 && l.length < 120)
    .slice(0, 10);

  return {
    mustHave: uniqueKeywords(mustHave).slice(0, 20),
    niceToHave: uniqueKeywords(niceToHave.filter((k) => !mustHave.includes(k))).slice(0, 15),
    roleKeywords: roleKeywords.slice(0, 8),
    responsibilities,
  };
}

export function parseKeywordExtractJson(raw: string): JobKeywords | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<JobKeywords>;
    return {
      mustHave: uniqueKeywords((parsed.mustHave ?? []).map(String)).slice(0, 20),
      niceToHave: uniqueKeywords((parsed.niceToHave ?? []).map(String)).slice(0, 15),
      roleKeywords: uniqueKeywords((parsed.roleKeywords ?? []).map(String)).slice(0, 8),
      responsibilities: uniqueKeywords((parsed.responsibilities ?? []).map(String)).slice(0, 10),
    };
  } catch {
    return null;
  }
}

export function buildKeywordExtractUserPrompt(
  jobTitle: string,
  jobDescription: string,
  companyName: string
): string {
  return [
    jobTitle && `Job title: ${jobTitle}`,
    `Company: ${companyName}`,
    jobDescription && `Job description:\n${jobDescription}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export { KEYWORD_EXTRACT_PROMPT, extractHeuristicKeywords };
