import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  const rawId = (await params).id;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return new Response(null, { status: 404 });
  const user = await prisma.user.findUnique({ where: { id }, select: { profilePhoto: true, profilePhotoMime: true } });
  if (!user?.profilePhoto || !user.profilePhotoMime) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(user.profilePhoto), {
    headers: {
      "Content-Type": user.profilePhotoMime,
      "Content-Length": String(user.profilePhoto.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline; filename=avatar",
    },
  });
}
