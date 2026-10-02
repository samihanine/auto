import { z } from "zod";

/** Swap the driver to move storage elsewhere (IndexedDB, REST API…). */
export type StorageDriver = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export const localStorageDriver: StorageDriver = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
};

/** A typed list of items with an `id`, stored under one key. */
export function collection<TSchema extends z.ZodType<{ id: string }>>(
  key: string,
  schema: TSchema,
  driver: StorageDriver = localStorageDriver,
) {
  type Item = z.output<TSchema>;
  const read = async (): Promise<Item[]> =>
    z.array(schema).parse(JSON.parse((await driver.getItem(key)) ?? "[]"));
  const write = (items: Item[]) => driver.setItem(key, JSON.stringify(items));

  return {
    list: read,
    get: async (id: string) => (await read()).find((item) => item.id === id),
    put: async (item: Item) => {
      const items = await read();
      const index = items.findIndex((other) => other.id === item.id);
      if (index === -1) items.push(item);
      else items[index] = item;
      await write(items);
      return item;
    },
    remove: async (id: string) => write((await read()).filter((item) => item.id !== id)),
  };
}

/** A typed object stored under one key; missing fields take the schema defaults. */
export function value<TSchema extends z.ZodType<object>>(
  key: string,
  schema: TSchema,
  driver: StorageDriver = localStorageDriver,
) {
  type Value = z.output<TSchema>;
  const get = async (): Promise<Value> => schema.parse(JSON.parse((await driver.getItem(key)) ?? "{}"));
  return {
    get,
    update: async (patch: Partial<Value>) => {
      const next = { ...(await get()), ...patch } as Value;
      await driver.setItem(key, JSON.stringify(next));
      return next;
    },
  };
}
