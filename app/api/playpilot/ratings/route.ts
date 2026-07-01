import { NextResponse } from 'next/server';
import { resolveProfileUuid } from '@/lib/playpilot/resolveProfile';
import { fetchAllRatings } from '@/lib/playpilot/fetchRatings';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim();

  if (!username) {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 });
  }

  try {
    const uuid = await resolveProfileUuid(username);
    const ratings = await fetchAllRatings(uuid);
    return NextResponse.json({ username, uuid, ratings });
  } catch (error) {
    console.error('PlayPilot ratings lookup failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch ratings';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
