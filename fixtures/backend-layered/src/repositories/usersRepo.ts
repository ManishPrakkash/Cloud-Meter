export async function listUsers(input: { page: number; limit: number }) {
  const { page, limit } = input;
  const db: any = (globalThis as any).db;
  return db.user.findMany({
    skip: page * limit,
    take: limit
  });
}

