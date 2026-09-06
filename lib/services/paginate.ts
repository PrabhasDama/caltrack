import "server-only";
export async function allRows<T>(
  fetch: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await fetch(offset, offset + 499);
    if (error || !data)
      throw new Error("Your records could not be loaded. Please retry.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
