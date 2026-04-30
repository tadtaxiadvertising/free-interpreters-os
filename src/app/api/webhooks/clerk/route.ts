import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses[0].email_address;
    const displayName = `${first_name} ${last_name}`.trim();

    await prisma.userProfile.create({
      data: {
        clerkId: id as string,
        email: email,
        displayName: displayName,
        role: 'interpreter', // Default role
      }
    });
  }

  if (eventType === 'user.updated') {
    const { email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses[0].email_address;
    const displayName = `${first_name} ${last_name}`.trim();

    await prisma.userProfile.update({
      where: { clerkId: id as string },
      data: {
        email: email,
        displayName: displayName,
      }
    });
  }

  if (eventType === 'user.deleted') {
    await prisma.userProfile.delete({
      where: { clerkId: id as string }
    });
  }

  return new Response('', { status: 200 });
}
