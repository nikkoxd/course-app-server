import express, { Request } from "express";
import { db } from "..";
import { answers, courses, tests, textBlocks } from "../schema";
import { and, eq, inArray, like, SQL, SQLWrapper } from "drizzle-orm";
import { z } from "zod";

export const coursesRouter = express.Router();

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
  *       "400":
  *         description: Invalid course ID
  */
coursesRouter.get("/", async (req, res) => {
  const querySchema = z.object({
    id: z.string().regex(/^[0-9]+$/).optional(),
    theme: z.string().optional(),
    readingTime: z.string().optional(),
    hasTests: z.string().optional(),
  });
  const parsedQuery = querySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).send(parsedQuery.error.issues);
  }

  if (parsedQuery.data?.id) {
    const id = Number(parsedQuery.data.id);

    if (isNaN(id)) {
      res.status(400).send("Invalid course ID");
    }

    try {
      const data = await db.query.courses.findFirst({
        where: eq(courses.id, id),
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
    } catch (error) {
      res.status(500).send("Internal server error");
    }

    return;
  }

  let filter: SQLWrapper[] = [];

  if (parsedQuery.data?.theme) {
    const theme = "%" + parsedQuery.data.theme + "%";
    filter.push(like(courses.theme, theme));
  }
  if (parsedQuery.data?.readingTime) {
    const readingTime = "%" + parsedQuery.data.readingTime + "%";
    filter.push(like(courses.readingTime, readingTime));
  }
  if (parsedQuery.data?.hasTests) {
    const hasTests = parsedQuery.data.hasTests === "true";
    filter.push(eq(courses.hasTests, hasTests));
  }

  try {
    const data = await db.query.courses.findMany({
      where: and(...filter),
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
  } catch (error) {
    res.status(500).send("Internal server error");
  }
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
coursesRouter.post("/", async (req, res) => {
  const bodySchema = z.object({
    theme: z.string(),
    readingTime: z.string(),
    hasTests: z.boolean(),
    textBlocks: z.array(z.object({
      name: z.string(),
      text: z.string(),
    })).min(1),
    tests: z.array(z.object({
      question: z.string(),
      answers: z.array(z.object({
        text: z.string(),
        right: z.boolean(),
      })).min(1),
    })).optional(),
  }).superRefine((data, ctx) => {
    if (data.hasTests && (!data.tests || data.tests.length == 0)) {
      ctx.addIssue({
        path: ["tests"],
        message: "Tests should be provided if hasTests is true",
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.hasTests && data.tests && data.tests.length > 0) {
      ctx.addIssue({
        path: ["tests"],
        message: "Tests should not be provided if hasTests is false",
        code: z.ZodIssueCode.custom,
      })
    }

    if (data.hasTests && data.tests) {
      for (const test of data.tests) {
        const rightCount = test.answers.filter((answer) => answer.right).length;
        if (rightCount == 0) {
          ctx.addIssue({
            path: ["tests", test.question, "answers"],
            message: "At least one answer should be marked as right",
            code: z.ZodIssueCode.custom,
          })
        }
        if (rightCount > 1) {
          ctx.addIssue({
            path: ["tests", test.question, "answers"],
            message: "At most one answer should be marked as right",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  });
  const parsedBody = bodySchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).send(parsedBody.error.issues);
  }

  if (parsedBody.data) {
    try {
      const [newCourse] = await db.insert(courses).values({
        theme: parsedBody.data.theme,
        readingTime: parsedBody.data.readingTime,
        hasTests: parsedBody.data.hasTests,
      }).returning();
      const courseId = newCourse.id;

      await db.insert(textBlocks).values(
        parsedBody.data.textBlocks.map((block) => ({
          courseId,
          name: block.name,
          text: block.text,
        }))
      );

      if (parsedBody.data.tests) {
        for (const test of parsedBody.data.tests) {
          const [newTest] = await db.insert(tests).values({ courseId, question: test.question }).returning();
          const testId = newTest.id;

          await db.insert(answers).values(
            test.answers.map((answer) => ({
              testId,
              text: answer.text,
              right: answer.right,
            }))
          );
        }
      }

      res.send("Course added");
    } catch (error) {
      res.status(500).send("Internal server error");
    }
  }
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
  *       "400":
  *         description: Invalid course ID
  *       "500":
  *         description: Internal server error
  */
coursesRouter.delete("/", async (req: Request<{ id: number }>, res) => {
  const courseId = Number(req.query.id);

  if (isNaN(courseId)) {
    res.status(400).send("Invalid course ID");
  }

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
    res.status(500).send("Internal server error");
  }
})
