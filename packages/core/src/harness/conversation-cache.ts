import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

const MAX_BYTES = 2 * 1024 * 1024;
const CheckpointSchema = z.object({
  version: z.literal(1),
  frames: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(10_000),
  summary: z.string().min(1).max(65_536),
}).strict();
const ChunkSchema = z.object({ key: z.string().regex(/^[a-f0-9]{64}$/), summary: z.string().min(1).max(65_536) }).strict();
const ChunksSchema = z.object({ version: z.literal(1), entries: z.array(ChunkSchema).max(32) }).strict();

export type ConversationCheckpoint = z.infer<typeof CheckpointSchema>;

export function conversationFrameHash(frame: string): string {
  return createHash("sha256").update(frame).digest("hex");
}

function checkpointPath(projectRoot: string, identity: string): string {
  return join(projectRoot, ".inkos", "context-cache", `${conversationFrameHash(identity)}.json`);
}

/** A derived cache, never execution authority. Missing/corrupt files are misses. */
export async function loadConversationCheckpoint(projectRoot: string, identity: string): Promise<ConversationCheckpoint | undefined> {
  const path = checkpointPath(projectRoot, identity);
  try {
    if ((await stat(path)).size > MAX_BYTES) return undefined;
    return CheckpointSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch { return undefined; }
}

export async function saveConversationCheckpoint(projectRoot: string, identity: string, checkpoint: ConversationCheckpoint): Promise<void> {
  const parsed = CheckpointSchema.safeParse(checkpoint);
  if (!parsed.success) return;
  const content = JSON.stringify(parsed.data);
  if (Buffer.byteLength(content) > MAX_BYTES) return;
  await writeCacheFile(checkpointPath(projectRoot, identity), content);
}

function chunkPath(projectRoot: string, sessionId: string): string {
  return checkpointPath(projectRoot, `compilation-chunks-v1:${sessionId}`);
}

async function loadChunks(projectRoot: string, sessionId: string): Promise<z.infer<typeof ChunksSchema>> {
  try {
    const path = chunkPath(projectRoot, sessionId);
    if ((await stat(path)).size > MAX_BYTES) return { version: 1, entries: [] };
    return ChunksSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch { return { version: 1, entries: [] }; }
}

export async function loadCompilationNotes(projectRoot: string, sessionId: string, key: string): Promise<string | undefined> {
  return (await loadChunks(projectRoot, sessionId)).entries.find(entry => entry.key === key)?.summary;
}

/** Keep at most 32 successful chunks / 2 MiB per session, across retries. */
export async function saveCompilationNotes(projectRoot: string, sessionId: string, key: string, summary: string): Promise<void> {
  const entry = ChunkSchema.safeParse({ key, summary });
  if (!entry.success) return;
  const saved = await loadChunks(projectRoot, sessionId);
  const entries = [...saved.entries.filter(item => item.key !== key), entry.data].slice(-32);
  let content = JSON.stringify({ version: 1, entries });
  while (Buffer.byteLength(content) > MAX_BYTES && entries.length) {
    entries.shift();
    content = JSON.stringify({ version: 1, entries });
  }
  await writeCacheFile(chunkPath(projectRoot, sessionId), content);
}

async function writeCacheFile(path: string, content: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } catch {
    // Failure to save an optimization must not fail the user's task.
  } finally { await rm(temporary, { force: true }).catch(() => {}); }
}
