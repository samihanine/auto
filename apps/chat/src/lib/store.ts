import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import { collection, value } from "@repo/storage";

import { AI } from "@repo/config";

export const MODELS = AI.models;

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  scope: z.string(),
  /** Conversation id on the AI side (APIs that keep the history server-side). */
  remoteId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  model: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Message = z.infer<typeof messageSchema>;

const settingsSchema = z.object({
  aiKey: z.string().default(""),
  model: z.enum(MODELS).default(MODELS[0]),
  /** Active conversation id per scope (host app). */
  conversations: z.record(z.string(), z.string()).default({}),
});
export type Settings = z.infer<typeof settingsSchema>;

export const store = {
  settings: value("chat:settings", settingsSchema),
  conversations: collection("chat:conversations", conversationSchema),
  /** Messages are stored per conversation to keep each entry small. */
  messages: (conversationId: string) => collection(`chat:messages:${conversationId}`, messageSchema),
};

const defaults = settingsSchema.parse({});

export function useSettings() {
  const client = useQueryClient();
  const { data = defaults } = useQuery({ queryKey: ["settings"], queryFn: store.settings.get });
  const update = useCallback(
    async (patch: Partial<Settings>) => client.setQueryData(["settings"], await store.settings.update(patch)),
    [client],
  );
  return [data, update] as const;
}
