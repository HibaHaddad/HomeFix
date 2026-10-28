import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { visibleProfessional } from "@/app/lib/professional-directory";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getClient()) return new Response(null, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response(null, { status: 404 });
  const user = await prisma.user.findFirst({ where: { ...visibleProfessional, id }, select: { profilePhoto: true, profilePhotoMime: true } });
  if (!user?.profilePhoto || !user.profilePhotoMime) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(user.profilePhoto), { headers: {
    "Content-Type": user.profilePhotoMime, "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline",
  } });
}
