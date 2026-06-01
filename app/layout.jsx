import { ClerkProvider } from "@clerk/nextjs";
import "../src/styles.css";
import { hasClerkEnv } from "@/lib/env";

export const metadata = {
  title: "BTC Investment Tracker",
  description: "Authenticated crypto tax ledger for tracking fiat, stablecoin, and BTC buys.",
};

export default function RootLayout({ children }) {
  const content = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  if (!hasClerkEnv()) return content;

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {content}
    </ClerkProvider>
  );
}
