/**
 * Task 32 - one-off migration runner: applies the official KS department
 * catalogue from ks-departments.ts (rename-in-place for the six seed codes,
 * create the remaining 학부/학과, published homepage links included).
 *
 * Run: bun prisma/migrate-ks-departments.ts
 */
import { PrismaClient } from "@prisma/client";
import { syncDepartments } from "./ks-departments";

const db = new PrismaClient();

syncDepartments()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
