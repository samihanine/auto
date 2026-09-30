import { z } from "zod";
import { conversationSchema, messageSchema, settingsSchema } from "./schemas";

/** Swap this driver to move storage elsewhere (IndexedDB, REST API…). */
export interface StorageDriver {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const localStorageDriver: StorageDriver = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
};

const PREFIX = "atelier:";

function collection<TSchema extends z.ZodType<{ id: string }>>(
  driver: StorageDriver,
  key: string,
  schema: TSchema,
) {
  type Item = z.output<TSchema>;
  const read = async (): Promise<Item[]> =>
    z.array(schema).parse(JSON.parse((await driver.getItem(PREFIX + key)) ?? "[]"));
  const write = (items: Item[]) =>
    driver.setItem(PREFIX + key, JSON.stringify(items));

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
    remove: async (id: string) =>
      write((await read()).filter((item) => item.id !== id)),
  };
}

function value<TSchema extends z.ZodType<object>>(driver: StorageDriver, key: string, schema: TSchema) {
  type Value = z.output<TSchema>;
  const get = async (): Promise<Value> =>
    schema.parse(JSON.parse((await driver.getItem(PREFIX + key)) ?? "{}"));
  return {
    get,
    update: async (patch: Partial<Value>) => {
      const next = { ...(await get()), ...patch } as Value;
      await driver.setItem(PREFIX + key, JSON.stringify(next));
      return next;
    },
  };
}

export function createStorage(driver: StorageDriver) {
  return {
    settings: value(driver, "settings", settingsSchema),
    conversations: collection(driver, "conversations", conversationSchema),
    /** Messages are stored per conversation to keep each entry small. */
    messages: (conversationId: string) =>
      collection(driver, `messages:${conversationId}`, messageSchema),
  };
}

export const storage = createStorage(localStorageDriver);
