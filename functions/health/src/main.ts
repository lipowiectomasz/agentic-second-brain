interface HealthContext {
  res: { json(body: unknown, status?: number): unknown };
}

export default async function main(context: HealthContext): Promise<unknown> {
  return context.res.json({ ok: true, runtime: process.version });
}
