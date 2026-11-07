// Aho–Corasick multi-pattern matcher (https://cp-algorithms.com/string/aho_corasick.html).
// Finds every occurrence of every pattern in ONE left-to-right pass over the
// text, so a k-word query costs O(text + matches) instead of k separate scans.
// Search builds one automaton per query and runs it over each candidate
// verse's (folded) fields.
//
// Transitions for ASCII are precomputed into a dense table (the "automaton"
// form of the algorithm), so the hot loop is one typed-array read per
// character with no suffix-link walking. Non-ASCII characters (Devanagari,
// leftover IAST) use the trie's maps plus suffix links.

const ASCII = 128;

export class AhoCorasick {
  readonly lengths: number[];
  private go: Int32Array;            // [node * 128 + charCode] -> next node, ASCII only
  private next: Map<number, number>[] = [new Map()]; // trie edges, all chars
  private link: number[] = [0];      // suffix links
  private out: number[] = [-1];      // dictionary links: nearest suffix ending a pattern
  private ends: number[][] = [[]];   // patterns ending exactly at each node

  constructor(patterns: string[]) {
    this.lengths = patterns.map((p) => p.length);
    patterns.forEach((p, i) => {
      if (!p) return;
      let v = 0;
      for (let j = 0; j < p.length; j++) {
        const c = p.charCodeAt(j);
        let u = this.next[v].get(c);
        if (u === undefined) {
          u = this.next.length;
          this.next.push(new Map());
          this.link.push(0);
          this.out.push(-1);
          this.ends.push([]);
          this.next[v].set(c, u);
        }
        v = u;
      }
      this.ends[v].push(i);
    });

    const n = this.next.length;
    this.go = new Int32Array(n * ASCII);
    // Root: missing ASCII edges loop back to the root (already 0).
    for (const [c, u] of this.next[0]) if (c < ASCII) this.go[c] = u;

    // BFS: a node's suffix link is final before any of its children are seen.
    const queue: number[] = [...this.next[0].values()];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      const lk = this.link[v];
      this.out[v] = this.ends[lk].length ? lk : this.out[lk];
      // Dense ASCII row: inherit the suffix link's row, then override with own edges.
      this.go.copyWithin(v * ASCII, lk * ASCII, lk * ASCII + ASCII);
      for (const [c, u] of this.next[v]) {
        if (c < ASCII) this.go[v * ASCII + c] = u;
        this.link[u] = v === 0 ? 0 : this.step(lk, c);
        queue.push(u);
      }
    }
  }

  // Transition for any char code (used while building and for non-ASCII).
  private step(v: number, c: number): number {
    if (c < ASCII) return this.go[v * ASCII + c];
    for (;;) {
      const u = this.next[v].get(c);
      if (u !== undefined) return u;
      if (v === 0) return 0;
      v = this.link[v];
    }
  }

  // Calls onMatch(patternIndex, start, endExclusive) for every occurrence.
  scan(text: string, onMatch: (pattern: number, start: number, end: number) => void): void {
    const { go, out, ends, lengths } = this;
    let v = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      v = c < ASCII ? go[v * ASCII + c] : this.step(v, c);
      for (let w = ends[v].length ? v : out[v]; w !== -1; w = out[w]) {
        const e = ends[w];
        for (let k = 0; k < e.length; k++) onMatch(e[k], i + 1 - lengths[e[k]], i + 1);
      }
    }
  }
}
