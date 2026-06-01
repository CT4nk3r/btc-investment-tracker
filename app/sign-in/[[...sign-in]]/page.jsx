import { SignIn } from "@clerk/nextjs";
import SetupRequired from "@/components/SetupRequired";
import { hasClerkEnv, missingPublicReleaseEnv } from "@/lib/env";

export default function SignInPage() {
  if (!hasClerkEnv()) return <SetupRequired missing={missingPublicReleaseEnv()} />;

  return (
    <main className="auth-shell">
      <SignIn />
    </main>
  );
}
