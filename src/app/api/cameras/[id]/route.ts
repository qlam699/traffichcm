import { isCameraId, trafficCameraSchema } from '@/features/cameras/schemas/camera';
import { logger } from '@/lib/logger';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { getTrafficCameraProvider } from '@/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!rateLimit(`camera:${clientKey(request)}`, 60, 60_000)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!isCameraId(id)) {
    return Response.json({ error: 'Invalid camera id' }, { status: 400 });
  }

  try {
    const camera = await getTrafficCameraProvider().getCameraById(id);
    if (!camera) {
      return Response.json({ error: 'Camera not found' }, { status: 404 });
    }
    return Response.json(trafficCameraSchema.parse(camera));
  } catch (error) {
    logger.error('Failed to load camera', error);
    return Response.json(
      { error: 'Camera details are currently unavailable. Please try again.' },
      { status: 502 },
    );
  }
}
