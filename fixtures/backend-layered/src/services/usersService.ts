import { listUsers } from "../repositories/usersRepo";

export const usersService = {
  async listUsers(input: { page: number; limit: number }) {
    return listUsers(input);
  }
};

