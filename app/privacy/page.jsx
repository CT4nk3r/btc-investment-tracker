import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article>
        <p className="eyebrow">Privacy</p>
        <h1>Privacy Policy</h1>
        <p>
          BTC Investment Tracker stores the trades you enter so you can review holdings, export records, and prepare tax
          documents. Account authentication is handled by Clerk. Ledger records are stored in the configured database and
          associated with your authenticated user ID.
        </p>
        <p>
          Do not enter exchange passwords, wallet seed phrases, private keys, or sensitive identity documents into notes
          or transaction text.
        </p>
        <p>
          Before public launch, replace this placeholder with policy text that matches the production operator, region,
          support contact, retention policy, and legal requirements.
        </p>
        <Link className="button-link" href="/">
          Back
        </Link>
      </article>
    </main>
  );
}
