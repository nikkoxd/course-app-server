import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import express from "express";
import bodyParser from "body-parser";
import * as schema from "./schema";
import SwaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { coursesRouter } from "./routes/api/courses";
import { adminRouter } from "./routes/admin";
import cors from "cors";
import cookieParser from "cookie-parser";

export const db = drizzle({
  connection: process.env.DB_FILE_NAME!,
  schema: schema,
});

const app = express();
const swaggerDocs = swaggerJSDoc({
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Courses API",
      version: "1.0.0",
      description: "API for managing courses",
    }
  },
  apis: ["./src/routes/api/*.ts"]
})

app.use(cors({
  origin: process.env.CORS_ORIGIN_URL,
  credentials: true,
}))
app.use(bodyParser.json());
app.use(cookieParser());

app.use("/api-docs", SwaggerUi.serve);
app.get("/api-docs", SwaggerUi.setup(swaggerDocs));
app.use("/api/courses", coursesRouter);
app.use("/admin", adminRouter);

app.listen(3000);
console.log("Server started on port 3000");
