'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createSession, getSession, destroySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { UserProfile } from '@/lib/types';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  try {
    const user = await (prisma as any).userProfile.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return { error: 'Invalid email or password' };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    await createSession(user.id, user.role);
    
    // The redirect should happen outside the try-catch or return a success flag
    return { success: true, role: user.role };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string || 'interpreter';

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  try {
    const existing = await (prisma as any).userProfile.findUnique({
      where: { email }
    });

    if (existing) {
      return { error: 'Email already exists' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await (prisma as any).userProfile.create({
      data: {
        email,
        passwordHash,
        displayName: name || email.split('@')[0],
        role
      }
    });

    await createSession(user.id, user.role);

    return { success: true, role: user.role };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'An unexpected error occurred during registration' };
  }
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const session = await getSession();
  
  if (!session || !session.userId) return null;

  try {
    const profile = await (prisma as any).userProfile.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        interpreterId: true,
        createdAt: true
      }
    });

    if (!profile) return null;

    return {
      id: profile.id,
      role: profile.role as any,
      interpreter_id: profile.interpreterId,
      display_name: profile.displayName || '',
      created_at: profile.createdAt.toISOString()
    };
  } catch (e) {
    return null;
  }
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
