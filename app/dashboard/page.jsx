import { UserButton } from "@clerk/nextjs";
import TrackerApp from "@/components/TrackerApp";
import SetupRequired from "@/components/SetupRequired";
import { missingPublicReleaseEnv, publicReleaseReady } from "@/lib/env";

export default function DashboardPage() {
  if (!publicReleaseReady()) {
    return <SetupRequired missing={missingPublicReleaseEnv()} />;
  }

  return (
    <>
      <div className="account-bar">
        <span>Authenticated ledger</span>
        <UserButton afterSignOutUrl="/" />
      </div>
      <TrackerApp />
    </>
  );
}
