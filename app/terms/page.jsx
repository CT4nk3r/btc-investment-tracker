import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article>
        <p className="eyebrow">Terms</p>
        <h1>Terms of Use</h1>
        <p>
          BTC Investment Tracker is a record-keeping tool. It estimates holdings, cost basis, and exchange-rate impact
          from the data users provide. It is not financial, legal, or tax advice.
        </p>
        <p>
          Users are responsible for verifying records against exchange statements and for following the tax rules that
          apply in their country.
        </p>
        <p>
          Before public launch, replace this placeholder with terms that match the production operator, support process,
          liability limits, and jurisdiction.
        </p>
        <Link className="button-link" href="/">
          Back
        </Link>
      </article>
    </main>
  );
}
