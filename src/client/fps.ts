/** Average frame rate over the last 1 s. */
export class FpsCounter {
  private readonly times: number[] = [];
  private head = 0;

  frame(now: number): number {
    this.times.push(now);
    while (this.head < this.times.length && this.times[this.head] < now - 1000) this.head++;
    if (this.head > 256) {
      this.times.splice(0, this.head);
      this.head = 0;
    }
    const n = this.times.length - this.head;
    if (n < 2) return 0;
    const span = now - this.times[this.head];
    return span > 0 ? ((n - 1) * 1000) / span : 0;
  }
}
