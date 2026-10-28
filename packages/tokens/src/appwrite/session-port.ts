import type { Users } from "node-appwrite";
import { AppwriteException } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import type { SessionPort, TokenOwner, UserDirectory } from "../repositories";

function isMissing(error: unknown): boolean {
  return error instanceof AppwriteException && (error.code === 404 || error.code === 401);
}

export class AppwriteSessionPort implements SessionPort {
  constructor(private readonly users: Users) {}

  async createSession(userId: string): Promise<string> {
    const session = await withTimeout("users.createSession", () => this.users.createSession({ userId }));
    return session.$id;
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await withTimeout("users.deleteSession", () => this.users.deleteSession({ userId, sessionId })).catch((error: unknown) => {
      if (isMissing(error)) return undefined;
      throw error;
    });
  }

  async createJwt(userId: string, sessionId: string, durationSeconds: number): Promise<{ jwt: string } | { sessionMissing: true }> {
    try {
      const token = await withTimeout("users.createJWT", () => this.users.createJWT({ userId, sessionId, duration: durationSeconds }));
      return { jwt: token.jwt };
    } catch (error) {
      if (isMissing(error)) return { sessionMissing: true };
      throw error;
    }
  }
}

export class AppwriteUserDirectory implements UserDirectory {
  constructor(private readonly users: Users) {}

  async getUser(userId: string): Promise<TokenOwner | null> {
    try {
      const user = await withTimeout("users.get", () => this.users.get({ userId }));
      return { name: user.name, email: user.email, labels: user.labels };
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 404) return null;
      throw error;
    }
  }
}
