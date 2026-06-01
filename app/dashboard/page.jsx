import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import TrackerApp from "@/components/TrackerApp";
import SetupRequired from "@/components/SetupRequired";
import { missingPublicReleaseEnv, publicReleaseReady } from "@/lib/env";

export default async function DashboardPage() {
  if (!publicReleaseReady()) {
    return <SetupRequired missing={missingPublicReleaseEnv()} />;
  }

  const user = await currentUser();
  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Your ledger";

  return (
    <>
      <div className="account-bar">
        <span>{displayName}</span>
        <UserButton afterSignOutUrl="/" />
      </div>
      <TrackerApp />
    </>
  );
}
