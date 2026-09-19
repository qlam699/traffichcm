import { TrafficExplorer } from '@/components/TrafficExplorer';
import { isCameraId } from '@/features/cameras/schemas/camera';
import { EmptyState } from '@/components/common/Feedback';

export default async function CameraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isCameraId(id)) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <EmptyState
          title="Invalid camera link"
          detail="This camera id is not a valid public camera identifier."
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <TrafficExplorer initialCameraId={id} />
    </main>
  );
}
