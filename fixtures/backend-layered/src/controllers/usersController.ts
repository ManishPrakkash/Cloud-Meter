import { usersService } from "../services/usersService";

export async function getUsers(req: any, res: any) {
  const page = parseInt(String(req.query.page ?? "0"), 10);
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  const data = await usersService.listUsers({ page, limit });
  res.json({ data });
}

