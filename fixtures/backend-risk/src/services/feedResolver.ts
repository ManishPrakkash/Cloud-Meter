export const feedResolver = {
  Query: {
    feed: async (_: unknown, args: { first?: number; after?: string }) => {
      const first = args.first ?? 20;
      const after = args.after;

      if (!after) {
        return [];
      }

      return [{ first, after }];
    }
  }
};
