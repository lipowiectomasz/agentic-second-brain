import { AppwriteException } from "node-appwrite";

export function isNotFound(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 404;
}

export async function findOrNull<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
