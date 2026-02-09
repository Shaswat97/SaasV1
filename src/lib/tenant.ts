import { prisma } from "@/lib/prisma";

export async function getDefaultCompanyId() {
  const company = await prisma.company.findFirst({
    where: { deletedAt: null },
    select: { id: true }
  });

  if (!company) {
    throw new Error("No company found. Seed the database first.");
  }

  return company.id;
}
