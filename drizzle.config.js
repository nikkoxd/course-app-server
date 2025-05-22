import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "src/schema.ts",
  url: "file:data.db",
})
