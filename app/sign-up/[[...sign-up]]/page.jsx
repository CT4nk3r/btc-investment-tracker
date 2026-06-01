import { SignUp } from "@clerk/nextjs";
import SetupRequired from "@/components/SetupRequired";
import { hasClerkEnv, missingPublicReleaseEnv } from "@/lib/env";

export default function SignUpPage() {
  if (!hasClerkEnv()) return <SetupRequired missing={missingPublicReleaseEnv()} />;

  return (
    <main className="auth-shell">
      <SignUp />
    </main>
  );
}
