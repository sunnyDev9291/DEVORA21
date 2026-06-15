import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    setError("");
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Logout failed. Please try again."));
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="border-b border-white/10 bg-navy-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold">
              D
            </span>
            <span className="font-semibold text-white">Devora21</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-bold text-white">
            Welcome{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-2 text-slate-400">
            You&apos;re signed in to your Devora21 dashboard.
          </p>

          {error && (
            <div
              className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Account
              </h2>
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="mt-0.5 text-sm font-medium text-white">{user?.email ?? "—"}</dd>
                </div>
                {user?.name && (
                  <div>
                    <dt className="text-xs text-slate-500">Name</dt>
                    <dd className="mt-0.5 text-sm font-medium text-white">{user.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-500">Email verified</dt>
                  <dd className="mt-0.5 text-sm font-medium text-white">
                    {user?.emailVerified === true ? (
                      <span className="text-emerald-400">Verified</span>
                    ) : user?.emailVerified === false ? (
                      <span className="text-amber-400">Pending verification</span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Quick actions
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Resume builder
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Interview prep
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  Account settings
                </li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                More features coming soon. Your session is secured with HTTP-only cookies.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
