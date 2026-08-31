"use client";



import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/lib/auth-api";

import { crawlJobs } from "@/lib/builtin-crawl-api";

import {

  BUILTIN_CRAWL_TIMEOUT_MS,

  DEFAULT_BUILTIN_LISTING_URL,

  DEFAULT_HIRINGCAFE_LISTING_URL,

  detectJobCrawlPlatform,

  isSupportedJobListingUrl,

  type JobCrawlPlatform,

  type JobCrawlResult,

} from "@/lib/builtin-crawl-types";



const inputClass =

  "w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm outline-none transition-all";



const PLATFORM_LABEL: Record<JobCrawlPlatform, string> = {

  builtin: "Built In",

  hiringcafe: "HiringCafe",

};



const PLATFORM_DEFAULT_URL: Record<JobCrawlPlatform, string> = {

  builtin: DEFAULT_BUILTIN_LISTING_URL,

  hiringcafe: DEFAULT_HIRINGCAFE_LISTING_URL,

};



const PLATFORM_HELP: Record<JobCrawlPlatform, string> = {

  builtin:

    "Paste a Built In page 1 listing URL. The backend crawls every pagination page — you never add &page=2 yourself.",

  hiringcafe:

    "Paste a HiringCafe page 0 listing URL (with searchState from your browser). The backend crawls every page — you never add &page=1 yourself.",

};



const PLATFORM_HINT: Record<JobCrawlPlatform, string> = {

  builtin: "Default: remote mid/senior roles in Argentina, updated in the last day.",

  hiringcafe: "Default: Argentina remote engineer/developer roles, fetched in the past 2 days.",

};



export default function BuiltInCrawlPanel() {

  const [platform, setPlatform] = useState<JobCrawlPlatform>("hiringcafe");

  const [listingUrl, setListingUrl] = useState(DEFAULT_HIRINGCAFE_LISTING_URL);

  const [crawling, setCrawling] = useState(false);

  const [error, setError] = useState("");

  const [result, setResult] = useState<JobCrawlResult | null>(null);



  const activePlatform = detectJobCrawlPlatform(listingUrl) ?? platform;

  const canCrawl = isSupportedJobListingUrl(listingUrl) && !crawling;



  const jobs = useMemo(() => result?.jobs ?? [], [result]);



  function selectPlatform(next: JobCrawlPlatform) {

    setPlatform(next);

    setListingUrl(PLATFORM_DEFAULT_URL[next]);

    setError("");

    setResult(null);

  }



  async function handleCrawl() {

    if (!canCrawl) return;



    setCrawling(true);

    setError("");

    setResult(null);



    const controller = new AbortController();

    const timer = window.setTimeout(() => controller.abort(), BUILTIN_CRAWL_TIMEOUT_MS);



    try {

      const data = await crawlJobs(listingUrl, controller.signal);

      setResult(data);

    } catch (err) {

      setError(getApiErrorMessage(err, "Job crawl failed."));

    } finally {

      window.clearTimeout(timer);

      setCrawling(false);

    }

  }



  return (

    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80 dark:shadow-black/30 sm:p-8">

      <div className="mb-6">

        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Job discovery</h2>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">

          {PLATFORM_HELP[activePlatform]}

        </p>

      </div>



      <div className="space-y-4">

        <div className="flex flex-wrap gap-2">

          {(Object.keys(PLATFORM_LABEL) as JobCrawlPlatform[]).map((key) => {

            const selected = platform === key;

            return (

              <button

                key={key}

                type="button"

                onClick={() => selectPlatform(key)}

                disabled={crawling}

                className={[

                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",

                  selected

                    ? key === "hiringcafe"

                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"

                      : "bg-violet-600 text-white shadow-md shadow-violet-600/25"

                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10",

                ].join(" ")}

              >

                {PLATFORM_LABEL[key]}

              </button>

            );

          })}

        </div>



        <div>

          <label htmlFor="jobListingUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">

            {PLATFORM_LABEL[activePlatform]} listing URL

          </label>

          <input

            id="jobListingUrl"

            type="url"

            value={listingUrl}

            onChange={(e) => setListingUrl(e.target.value)}

            placeholder={

              activePlatform === "hiringcafe"

                ? "https://hiringcafe.com/?searchState=…"

                : "https://builtin.com/jobs/…"

            }

            className={inputClass}

            disabled={crawling}

            spellCheck={false}

          />

          <p className="mt-1.5 text-xs text-slate-400">{PLATFORM_HINT[activePlatform]}</p>

        </div>



        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">

          <button

            type="button"

            onClick={() => void handleCrawl()}

            disabled={!canCrawl}

            className={[

              "inline-flex items-center justify-center gap-2 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg",

              activePlatform === "hiringcafe"

                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25"

                : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/25",

            ].join(" ")}

          >

            {crawling ? (

              <>

                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">

                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                </svg>

                Crawling {PLATFORM_LABEL[activePlatform]}…

              </>

            ) : (

              <>

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

                </svg>

                Crawl jobs

              </>

            )}

          </button>

          {crawling ? (

            <p className="text-sm text-slate-500 dark:text-slate-400">

              This can take <strong className="font-semibold">30–90+ seconds</strong> while multiple pages are scraped…

            </p>

          ) : null}

        </div>

      </div>



      {error ? (

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3">

          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">

            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

          </svg>

          <p className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">{error}</p>

        </div>

      ) : null}



      {result ? (

        <div className="mt-8 space-y-4">

          <div className="flex flex-wrap items-center gap-3 text-sm">

            <span

              className={[

                "inline-flex items-center rounded-full px-3 py-1 font-semibold",

                result.platform === "hiringcafe"

                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"

                  : "bg-violet-500/15 text-violet-700 dark:text-violet-300",

              ].join(" ")}

            >

              {PLATFORM_LABEL[result.platform]}

            </span>

            <span className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">

              {result.totalCount} job{result.totalCount === 1 ? "" : "s"}

            </span>

            {typeof result.pagesScraped === "number" && result.pagesScraped > 0 ? (

              <span className="text-slate-500 dark:text-slate-400">

                {result.pagesScraped} page{result.pagesScraped === 1 ? "" : "s"} scraped

              </span>

            ) : null}

            <span className="text-slate-400 dark:text-slate-500 truncate max-w-full" title={result.sourceUrl}>

              {result.sourceUrl}

            </span>

          </div>



          {jobs.length === 0 ? (

            <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-200">

              Crawl finished but no jobs were returned.

            </p>

          ) : (

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">

              <table className="min-w-full text-sm">

                <thead className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">

                  <tr>

                    <th className="px-4 py-3 font-semibold">Company</th>

                    <th className="px-4 py-3 font-semibold">Job title</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">

                  {jobs.map((job, index) => (

                    <tr key={`${job.jobId}-${index}`} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">

                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">

                        {job.companyName || "—"}

                      </td>

                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">

                        {job.jobUrl ? (

                          <a

                            href={job.jobUrl}

                            target="_blank"

                            rel="noopener noreferrer"

                            className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"

                          >

                            {job.jobTitle}

                          </a>

                        ) : (

                          job.jobTitle

                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      ) : null}

    </div>

  );

}


