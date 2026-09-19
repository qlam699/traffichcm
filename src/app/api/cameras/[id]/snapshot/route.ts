import { isCameraId } from '@/features/cameras/schemas/camera';
import { logger } from '@/lib/logger';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { getTrafficCameraProvider } from '@/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!rateLimit(`snapshot:${clientKey(request)}`, 240, 60_000)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!isCameraId(id)) {
    return Response.json({ error: 'Invalid camera id' }, { status: 400 });
  }

  try {
    const snapshot = await getTrafficCameraProvider().getSnapshot(id);
    if (!snapshot) {
      return Response.json({ error: 'Snapshot is not available' }, { status: 404 });
    }

    return new Response(Buffer.from(snapshot.body), {
      headers: {
        'Content-Type': snapshot.contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Failed to fetch camera snapshot', error);
    return Response.json({ error: 'Snapshot is not available' }, { status: 502 });
  }
}
