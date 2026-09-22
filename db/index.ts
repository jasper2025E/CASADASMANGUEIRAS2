import * as schema from "./schema";

interface MockDb {
  schema: typeof schema;
  select: () => {
    from: (target: unknown) => {
      orderBy: (...args: unknown[]) => {
        limit: (n: number) => Promise<unknown[]>;
      };
    };
  };
  insert: (target: unknown) => {
    values: (data: unknown) => {
      returning: () => Promise<unknown[]>;
    };
  };
}

export function getDb(): MockDb {
  return {
    schema,
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: async () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [],
      }),
    }),
  };
}
