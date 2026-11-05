import { auth, clerkClient } from "@clerk/nextjs/server";

export type AdminIdentity = { userId: string; email: string };

const setupOwnerEmails = [
  "pravomishri98@gmail.com",
  "retreatodisha@gmail.com",
  "retreat.odisha11@gmail.com",
  "prabhudattamishra600@gmail.com",
  "villageretreat.puri@gmail.com",
  "parvo.office@gmail.com"
];

function getAllowedAdminEmails() {
  return new Set([
    ...setupOwnerEmails,
    ...(process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
  ]);
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const allowed = getAllowedAdminEmails();
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase();
    return email && allowed.has(email) ? { userId, email } : null;
  } catch { return null; }
}

export async function getAdminIdentityForRequest(request: Request): Promise<AdminIdentity | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  void request;
  const { userId } = await auth();
  if (!userId) return null;
  const allowed = getAllowedAdminEmails();
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase();
    return email && allowed.has(email) ? { userId, email } : null;
  } catch { return null; }
}
