import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

// Bump this when the generated Prisma model changes. During next dev, the
// global singleton can otherwise keep a client created from the old schema.
const prismaSchemaVersion = "20261025-professional-profile-photo";
const shouldReuseClient =
  process.env.NODE_ENV !== "development" ||
  globalForPrisma.prismaSchemaVersion === prismaSchemaVersion;

export const prisma = shouldReuseClient && globalForPrisma.prisma
  ? globalForPrisma.prisma
  : new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = prismaSchemaVersion;
}
