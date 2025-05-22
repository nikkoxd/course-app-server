import { Request, Router } from "express";
import { db } from "..";
import { answers, courses, tests, textBlocks } from "../schema";
import { eq, inArray } from "drizzle-orm";

export const coursesRouter = Router();

/**
  * @openapi
  * /courses:
  *   get:
  *     description: Get all courses
  *     parameters:
  *       - in: query
  *         name: id
  *         schema:
  *           type: integer
  *         description: ID of the course to get
  *
  *     responses:
  *       "200":
  *         description: OK
  */
coursesRouter.get("/courses", async (req, res) => {
  const courseId = Number(req.query.id);

  if (courseId) {
    const data = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      with: {
        textBlocks: true,
        tests: {
          with: {
            answers: true,
          },
        },
      },
    })

    res.send(data);
    return;
  }

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

/**
  * @openapi
  * /courses:
  *   post:
  *     description: Add a course
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             properties:
  *               theme:
  *                 type: string
  *               readingTime:
  *                 type: string
  *               textBlocks:
  *                 type: array
  *                 items: 
  *                   type: object
  *                   properties:
  *                     name:
  *                       type: string
  *                     text:
  *                       type: string
  *               tests:
  *                 type: array
  *                 items:
  *                   type: object
  *                   properties:
  *                     question:
  *                       type: string
  *                     answers:
  *                       type: array
  *                       items:
  *                         type: object
  *                         properties:
  *                           text: 
  *                             type: string
  *                           right: 
  *                             type: boolean
  *
  *     responses:
  *       "200":
  *         description: OK
  */
coursesRouter.post("/courses", async (req, res) => {
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

/**
  * @openapi
  * /courses:
  *   delete:
  *     description: Delete a course
  *     parameters:
  *       - in: query
  *         name: id
  *         schema:
  *           type: integer
  *         description: ID of the course to delete
  *
  *     responses:
  *       "200":
  *         description: OK
  *       "500":
  *         description: Internal server error
  */
coursesRouter.delete("/courses", async (req: Request<{ id: number }>, res) => {
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
