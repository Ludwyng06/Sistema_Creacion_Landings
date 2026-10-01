import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee .env solo: cargamos primero .env.local (secretos y ajustes locales).
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
