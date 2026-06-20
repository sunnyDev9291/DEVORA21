const TRIGGER_TIMEOUT_MS = 15_000;

function resolveDeployBaseUrl(): string {
  const base = process.env.DEPLOY_PRIME_URL || process.env.URL || "";
  if (!base) {
    throw new Error("Deploy URL is not configured for background resume generation.");
  }
  return base.replace(/\/$/, "");
}

export function getResumeBackgroundTriggerUrl(): string {
  return `${resolveDeployBaseUrl()}/.netlify/functions/resume-generate-background`;
}

/** Invoke the Netlify background function; throws if the worker cannot be queued. */
export async function triggerResumeBackgroundWorker(jobId: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS);

  try {
    const response = await fetch(getResumeBackgroundTriggerUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      signal: controller.signal,
    });

    if (response.status === 202 || response.ok) {
      return;
    }

    const detail = await response.text().catch(() => "");
    throw new Error(
      detail || `Background worker rejected the job (${response.status}).`
    );
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Timed out while starting background resume generation.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
