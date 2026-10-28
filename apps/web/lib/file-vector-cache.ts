import "server-only";
import { createFileVectorCache } from "@cortex/knowledge";

export const fileVectorCache = createFileVectorCache(2000);
