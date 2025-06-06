import { relations } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const courses = sqliteTable("courses", {
  id: int("id").primaryKey({ autoIncrement: true }),
  theme: text("theme").notNull(),
  readingTime: text("reading_time").notNull(),
  hasTests: int("has_tests", { mode: "boolean" }).notNull(),
})

export const coursesRelations = relations(courses, ({ many }) => ({
  textBlocks: many(textBlocks),
  tests: many(tests)
}))

export const textBlocks = sqliteTable("text_blocks", {
  id: int("id").primaryKey({ autoIncrement: true }),
  courseId: int("course_id").notNull(),
  name: text("name").notNull(),
  text: text("text").notNull(),
})

export const textBlocksRelations = relations(textBlocks, ({ one }) => ({
  course: one(courses, { fields: [textBlocks.courseId], references: [courses.id] }),
}))

export const tests = sqliteTable("tests", {
  id: int("id").primaryKey({ autoIncrement: true }),
  courseId: int("course_id").notNull(),
  question: text("question").notNull(),
})

export const testsRelations = relations(tests, ({ one, many }) => ({
  course: one(courses, { fields: [tests.courseId], references: [courses.id] }),
  answers: many(answers),
}))

export const answers = sqliteTable("answers", {
  id: int("id").primaryKey({ autoIncrement: true }),
  testId: int("test_id").notNull(),
  text: text("text").notNull(),
  right: int("right", { mode: "boolean" }).notNull(),
})

export const answersRelations = relations(answers, ({ one }) => ({
  test: one(tests, { fields: [answers.testId], references: [tests.id] }),
}))

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  hashedPassword: text("password").notNull(),
})
