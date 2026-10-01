import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 exige un adaptador de controlador para SQLite.
const url = process.env.DATABASE_URL ?? "file:./dev.db";

const globalParaDb = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  globalParaDb.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

if (process.env.NODE_ENV !== "production") globalParaDb.prisma = db;
