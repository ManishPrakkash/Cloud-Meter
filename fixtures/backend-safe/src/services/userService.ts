type CursorInput = {
  cursor?: string;
  limit?: number;
};

export async function listUsersKeyset(input: CursorInput) {
  const limit = Math.min(input.limit ?? 20, 50);
  const cursor = input.cursor;

  // Representative keyset-like query shape in code
  return {
    where: {
      createdAt: { gt: cursor },
      _id: { gt: cursor }
    },
    orderBy: [{ createdAt: "asc" }, { _id: "asc" }],
    take: limit
  };
}
