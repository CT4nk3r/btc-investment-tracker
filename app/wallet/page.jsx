import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import WalletTransactions from "@/components/WalletTransactions";
import SetupRequired from "@/components/SetupRequired";
import { missingPublicReleaseEnv, publicReleaseReady } from "@/lib/env";

export default async function WalletPage() {
  if (!publicReleaseReady()) {
    return <SetupRequired missing={missingPublicReleaseEnv()} />;
  }

  const user = await currentUser();
  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Your wallet";

  return (
    <>
      <div className="account-bar">
        <nav className="account-nav" aria-label="Account navigation">
          <Link href="/dashboard">Ledger</Link>
          <Link href="/wallet" aria-current="page">Wallet activity</Link>
        </nav>
        <div className="account-user">
          <span>{displayName}</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
      <WalletTransactions />
    </>
  );
}
