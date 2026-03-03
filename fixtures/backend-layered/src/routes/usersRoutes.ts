import { getUsers } from "../controllers/usersController";

export function registerRoutes(app: any) {
  app.get("/users", getUsers);
}

