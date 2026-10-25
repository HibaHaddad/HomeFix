import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import ProfessionalWorkspace from "@/components/professional/ProfessionalWorkspace";
import "./professional.css";

export default async function ProfessionalLayout({ children }: LayoutProps<"/professionnel">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, role: true, status: true, businessName: true, specialty: true } });
  if (!user) redirect("/login");
  if (user.role !== "PROFESSIONAL") redirect("/dashboard");
  if (user.status !== "APPROVED") redirect("/login");

  const photoState = await prisma.$queryRaw<Array<{ hasPhoto: boolean }>>`
    SELECT "profilePhotoMime" IS NOT NULL AS "hasPhoto"
    FROM "User" WHERE "id" = ${user.id}
  `;

  return <ProfessionalWorkspace user={{ ...user, hasProfilePhoto: photoState[0]?.hasPhoto ?? false }}>{children}</ProfessionalWorkspace>;
}
