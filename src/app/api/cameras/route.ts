import { cameraListResultSchema, cameraQuerySchema } from '@/features/cameras/schemas/camera';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { getTrafficCameraProvider } from '@/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!rateLimit(`cameras:${clientKey(request)}`, 30, 60_000)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsedQuery = cameraQuerySchema.safeParse({
    query: url.searchParams.get('query') ?? undefined,
    district: url.searchParams.get('district') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    north: url.searchParams.get('north') ?? undefined,
    south: url.searchParams.get('south') ?? undefined,
    east: url.searchParams.get('east') ?? undefined,
    west: url.searchParams.get('west') ?? undefined,
  });

  if (!parsedQuery.success) {
    return Response.json({ error: 'Invalid camera query' }, { status: 400 });
  }

  const bounds =
    parsedQuery.data.north !== undefined &&
    parsedQuery.data.south !== undefined &&
    parsedQuery.data.east !== undefined &&
    parsedQuery.data.west !== undefined
      ? {
          north: parsedQuery.data.north,
          south: parsedQuery.data.south,
          east: parsedQuery.data.east,
          west: parsedQuery.data.west,
        }
      : undefined;

  try {
    const provider = getTrafficCameraProvider();
    const cameras = await provider.getCameras({
      query: parsedQuery.data.query,
      district: parsedQuery.data.district,
      status: parsedQuery.data.status,
      bounds,
    });

    const payload = cameraListResultSchema.parse({
      cameras,
      provider: provider.name,
      fetchedAt: new Date().toISOString(),
      warning:
        provider.name === 'mock'
          ? 'Showing labeled mock cameras. Live HCMC data is disabled.'
          : undefined,
    });

    return Response.json(payload, {
      headers: {
        'Cache-Control': `private, max-age=${getEnv().CAMERA_METADATA_CACHE_TTL_SECONDS}`,
      },
    });
  } catch (error) {
    logger.error('Failed to list cameras', error);
    return Response.json(
      { error: 'Camera list is currently unavailable. Please try again.' },
      { status: 502 },
    );
  }
}
