import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function SetupRequired({ missing }) {
  return (
    <main className="setup-page">
      <div className="setup-card">
        <AlertTriangle size={28} />
        <p className="eyebrow">Release setup</p>
        <h1>Account services are not connected yet.</h1>
        <p>
          The code is prepared for public launch. Connect Clerk and Neon in Vercel, then add these environment variables.
        </p>
        <div className="missing-list">
          {missing.map((name) => (
            <code key={name}>{name}</code>
          ))}
        </div>
        <div className="setup-checklist">
          <span>
            <CheckCircle2 size={16} />
            Clerk login/register routes are implemented.
          </span>
          <span>
            <CheckCircle2 size={16} />
            Neon ledger API routes are implemented.
          </span>
          <span>
            <CheckCircle2 size={16} />
            Export/import remains available after login.
          </span>
        </div>
        <Link href="/" className="button-link">
          Back to home
        </Link>
      </div>
    </main>
  );
}
