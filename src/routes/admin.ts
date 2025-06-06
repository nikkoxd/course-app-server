import express from "express";
import { z } from "zod";
import { db } from "..";
import { courses, users } from "../schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticate } from "../middleware/auth";

export const adminRouter = express.Router();

adminRouter.post("/login", async (req, res) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }

  const userSchema = z.object({
    username: z.string(),
    password: z.string(),
  });

  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).send(parsed.error.issues);
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.username, parsed.data.username));
  const isPasswordCorrect = await bcrypt.compare(parsed.data.password, user.hashedPassword);

  if (!isPasswordCorrect) {
    res.status(401).send("Incorrent password");
  }

  const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1m" });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  res
    .cookie("access-token", accessToken, { httpOnly: true, expires: new Date(Date.now() + 60_000) })
    .cookie("refresh-token", refreshToken, { httpOnly: true, expires: new Date(Date.now() + 60 * 60_000) })
    .send("Logged in");
})

adminRouter.post("/refresh", async (req, res) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }

  const refreshToken = req.cookies["refresh-token"];
  if (!refreshToken) {
    res.status(401).send("No refresh token");
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const accessToken = jwt.sign({ decoded }, process.env.JWT_SECRET, { expiresIn: "1m" });

    res
      .cookie("access-token", accessToken, { httpOnly: true, expires: new Date(Date.now() + 60_000) })
      .send("Refreshed");
  } catch {
    res.status(401).send("Invalid refresh token");
    return;
  }
})

adminRouter.get("/data", authenticate, async (req, res) => {
  const data = await db.select().from(courses);
  res.send(data);
})

adminRouter.get("/user", authenticate, async (req, res) => {
  console.log(res.locals);
  // const user = await db.select({ id: users.id, username: users.username}).from(users).where(eq(users.id, res.locals.user.id));
  // res.send(user);
  res.send({ id: 1, username: "admin" });
})
