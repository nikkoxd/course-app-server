import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import express, { Request } from "express";
import { answers, courses, tests, textBlocks } from "./schema";
import bodyParser from "body-parser";
import { eq, inArray } from "drizzle-orm";
import * as schema from "./schema";

const app = express();
const db = drizzle({
  connection: process.env.DB_FILE_NAME!,
  schema: schema,
});

app.use(bodyParser.json());

app.get("/courses", async (_req, res) => {
  const data = await db.query.courses.findMany({
    with: {
      textBlocks: true,
      tests: {
        with: {
          answers: true,
        },
      },
    },
  });

  res.send(data);
})

app.post("/add_course", async (req, res) => {
  const { theme, readingTime, hasTests, textBlocks: tb, tests: t } = req.body;

  const [newCourse] = await db.insert(courses).values({ theme, readingTime, hasTests }).returning();
  const courseId = newCourse.id;

  if (tb.length > 0) {
    await db.insert(textBlocks).values(
      tb.map((block: typeof textBlocks) => ({
        courseId,
        name: block.name,
        text: block.text,
      }))
    );
  }

  if (t.length > 0) {
    for (const test of t) {
      const [newTest] = await db.insert(tests).values({ courseId, question: test.question }).returning();
      const testId = newTest.id;

      if (test.answers.length > 0) {
        await db.insert(answers).values(
          test.answers.map((answer: typeof answers) => ({
            testId,
            text: answer.text,
            right: answer.right,
          }))
        );
      }
    }
  }

  res.send("Course added");
})

app.post("/remove_course", async (req: Request<{ id: number }>, res) => {
  const courseId = Number(req.query.id);

  try {
    await db.transaction(async (tx) => {
      const testIds = await tx.select({ id: tests.id }).from(tests).where(eq(tests.courseId, courseId));
      const testIdArr = testIds.map((t) => t.id);

      if (testIds.length > 0) {
        await tx.delete(answers).where(inArray(answers.testId, testIdArr))
      }

      await tx.delete(tests).where(eq(tests.courseId, courseId));
      await tx.delete(textBlocks).where(eq(textBlocks.courseId, courseId));
      await tx.delete(courses).where(eq(courses.id, courseId));
    })

    res.send("Course removed");
  } catch (error) {
    res.status(500).send(`Failed to remove course: ${error}`);
  }
})

app.listen(3000);
console.log("Server started on port 3000");
