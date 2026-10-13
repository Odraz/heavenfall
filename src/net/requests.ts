/** Run-local reliable interaction replay window. IDs never wrap or reset on reconnect. */
export class ScopedRequests<T> {
  next = 1;
  private readonly results = new Map<number, { scope: string; result: T }>();
  execute(id: number, scope: string, apply: () => T): T | null {
    if (!Number.isInteger(id) || id < 1 || id > 0xffffffff || scope.length > 80) return null;
    const cached = this.results.get(id);
    if (cached) return cached.scope === scope ? cached.result : null;
    if (id < this.next) return null;
    this.next = id + 1;
    const result = apply(); this.results.set(id, { scope, result });
    while (this.results.size > 64) this.results.delete(this.results.keys().next().value!);
    return result;
  }
}
