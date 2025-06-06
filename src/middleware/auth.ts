import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }

  const accessToken = req.cookies["access-token"];
  const refreshToken = req.cookies["refresh-token"];
  if (!accessToken && !refreshToken) {
    res.status(401).send("No token provided");
    return;
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    res.locals.user = decoded;
    next();
  } catch (error) {
    if (!refreshToken) {
      res.status(401).send("No refresh token provided");
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      const accessToken = jwt.sign(
        { decoded },
        process.env.JWT_SECRET,
        { expiresIn: "1m" }
      );

      res.cookie(
        "access-token",
        accessToken,
        { httpOnly: true, expires: new Date(Date.now() + 60_000) }
      );
      res.locals.user = decoded;
      next();
    } catch (error) {
      res.status(401).send("Invalid refresh token");
    }
  }
}
