import { Request, Response } from "express";
import { User } from "../models/User";

export async function listUsers(req: Request, res: Response) {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);

  const users = await User.find({})
    .skip(page * limit)
    .limit(limit);

  res.json(users);
}
