export class TimeoutError extends Error {
  constructor(readonly operation: string, readonly milliseconds: number) {
    super(`${operation} timed out after ${milliseconds} ms`);
    this.name = "TimeoutError";
  }
}

export const defaultTimeoutMs = 30_000;

export async function withTimeout<T>(operation: string, run: () => Promise<T>, milliseconds = defaultTimeoutMs): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(operation, milliseconds)), milliseconds);
  });
  try {
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
