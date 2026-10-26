"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import {
  saBtnPrimary,
  saDisplay,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catch client render failures (including extension DOM fights) so Super Admin
 * does not fall through to Next's blank "Application error" screen.
 */
export default class SuperAdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Super Admin]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "Unknown client error";
    const looksLikeExtensionDom =
      /removeChild|insertBefore|not a child of this node/i.test(message);

    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16">
        <div className="sa-glass p-7 sm:p-9">
          <h1 className={`${saDisplay} text-2xl font-extrabold text-slate-900`}>
            Super Admin hit a client error
          </h1>
          <p className={`${saMono} mt-3 text-xs leading-relaxed text-slate-500`}>
            {looksLikeExtensionDom ? (
              <>
                A browser extension (for example IPA Reader / Annotator, Grammarly,
                or a page translator) changed the page DOM while React was updating
                it. Disable that extension on this site, then reload.
              </>
            ) : (
              <>Something broke while rendering this page. Reload and try again.</>
            )}
          </p>
          <p className={`${saMono} mt-3 break-words rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-rose-700`}>
            {message}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className={saBtnPrimary}
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </button>
            <Link
              href={AUTH_LINKS.superAdmin}
              className={`${saMono} inline-flex items-center text-[11px] text-teal-700 underline-offset-4 hover:underline`}
            >
              ← Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
