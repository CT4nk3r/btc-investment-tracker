import Link from "next/link";
import { Bitcoin, Database, Download, LockKeyhole } from "lucide-react";
import { hasClerkEnv, missingPublicReleaseEnv } from "@/lib/env";

export default function HomePage() {
  const authReady = hasClerkEnv();
  const missing = missingPublicReleaseEnv();

  return (
    <main className="public-shell">
      <nav className="public-nav">
        <Link href="/" className="brand-link">
          <Bitcoin size={22} />
          <span>BTC Investment Tracker</span>
        </Link>
        <div className="public-nav-actions">
          {authReady ? (
            <>
              <Link className="button-link" href="/dashboard">
                Dashboard
              </Link>
              <Link className="button-link" href="/sign-in">
                Log in
              </Link>
              <Link className="button-link primary-link" href="/sign-up">
                Register
              </Link>
            </>
          ) : (
            <Link className="button-link" href="/dashboard">
              Setup
            </Link>
          )}
        </div>
      </nav>

      <section className="public-hero">
        <div className="hero-copy">
          <p className="eyebrow">Crypto tax ledger</p>
          <h1>Track every EUR, USDC, and BTC step under your account.</h1>
          <p>
            Enter trades naturally, keep FIFO cost basis, monitor stablecoin FX drag, and export clean backups before tax
            filing.
          </p>
          <div className="hero-actions">
            {authReady ? (
              <>
                <Link className="button-link primary-link" href="/sign-up">
                  Create account
                </Link>
                <Link className="button-link" href="/sign-in">
                  Log in
                </Link>
                <Link className="button-link" href="/dashboard">
                  Open dashboard
                </Link>
              </>
            ) : (
              <Link className="button-link primary-link" href="/dashboard">
                Finish setup
              </Link>
            )}
          </div>
        </div>

        <div className="hero-panel">
          <div>
            <LockKeyhole size={22} />
            <strong>Private by user</strong>
            <span>Clerk protects dashboard and API routes.</span>
          </div>
          <div>
            <Database size={22} />
            <strong>Cloud ledger</strong>
            <span>Neon stores rows by authenticated user ID.</span>
          </div>
          <div>
            <Download size={22} />
            <strong>Portable records</strong>
            <span>JSON and CSV exports remain available.</span>
          </div>
        </div>
      </section>

      {!authReady || missing.includes("DATABASE_URL") ? (
        <section className="setup-strip">
          <strong>Public release setup pending</strong>
          <span>Missing: {missing.join(", ") || "none"}</span>
        </section>
      ) : null}
      <footer className="public-footer">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </main>
  );
}
