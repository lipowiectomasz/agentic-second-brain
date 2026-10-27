export function meanVector(vectors: number[][]): number[] {
  const first = vectors[0];
  if (first === undefined) return [];
  const sum = new Array<number>(first.length).fill(0);
  for (const vector of vectors) {
    for (const [index, value] of vector.entries()) sum[index] = (sum[index] ?? 0) + value;
  }
  return sum.map((value) => value / vectors.length);
}

export function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  return length === 0 ? vector.map(() => 0) : vector.map((value) => value / length);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [index, value] of a.entries()) {
    const other = b[index] ?? 0;
    dot += value * other;
    normA += value * value;
    normB += other * other;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

export function similarityFromDistance(distance: number): number {
  return Math.min(1, Math.max(0, 1 - distance));
}
