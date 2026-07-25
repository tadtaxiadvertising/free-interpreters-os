'use client';

import React from 'react';
import ActivityTracker from '@/components/ActivityTracker';

interface ActivityTrackerClientProps {
  interpreterId: number | null | undefined;
}

/**
 * Client wrapper for ActivityTracker — needed because ActivityTracker
 * uses hooks (useEffect, useState) and must be a client component.
 * 
 * This is imported from a server component layout.
 */
export default function ActivityTrackerClient({ interpreterId }: ActivityTrackerClientProps) {
  if (!interpreterId) return null;
  return <ActivityTracker interpreterId={interpreterId} />;
}