export function hasClerkEnv() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function hasDatabaseEnv() {
  return Boolean(process.env.DATABASE_URL);
}

export function publicReleaseReady() {
  return hasClerkEnv() && hasDatabaseEnv();
}

export function missingPublicReleaseEnv() {
  return [
    ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY],
    ["CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}
