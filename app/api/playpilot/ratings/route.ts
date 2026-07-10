import { resolveProfileUuid } from '@/lib/playpilot/resolveProfile';
import { fetchAllRatings } from '@/lib/playpilot/fetchRatings';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim();

  if (!username) {
    return new Response(JSON.stringify({ error: 'Missing username' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const { uuid, totalRatings } = await resolveProfileUuid(username, {
          onRetry: info => send({ type: 'retry', ...info }),
        });
        const ratings = await fetchAllRatings(uuid);
        send({ type: 'done', username, uuid, ratings, totalRatings });
      } catch (error) {
        console.error('PlayPilot ratings lookup failed:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch ratings';
        send({ type: 'error', error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
