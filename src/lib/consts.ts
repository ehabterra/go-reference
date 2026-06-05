export const SITE_TITLE = 'The Go Reference';
export const SITE_DESC =
  'A visual, Go-first reference — every Gang-of-Four design pattern and a deep concurrency guide, with diagrams, runnable code, quizzes and progress tracking.';

export interface CategoryMeta {
  key: string;
  title: string;
  blurb: string;
}

/** Design-pattern categories (the journey on /patterns/). */
export const CATEGORIES: CategoryMeta[] = [
  {
    key: 'creational',
    title: 'Creational',
    blurb:
      'How objects get made — controlling instantiation so the rest of your code never cares about concrete types.',
  },
  {
    key: 'structural',
    title: 'Structural',
    blurb:
      'How objects are composed — assembling types into larger structures while keeping them flexible.',
  },
  {
    key: 'behavioral',
    title: 'Behavioral',
    blurb:
      'How objects collaborate — assigning responsibilities and managing the flow of communication.',
  },
  {
    key: 'concurrency',
    title: 'Go Concurrency Patterns',
    blurb:
      'The patterns that make Go special — goroutines and channels composed into pipelines, pools and safe cancellation.',
  },
];

/** Concurrency-reference categories (the journey on /concurrency/). */
export const CONCURRENCY_CATEGORIES: CategoryMeta[] = [
  {
    key: 'foundations',
    title: 'Foundations',
    blurb:
      'The hard truths first — what concurrency is, why it bites, and the failure modes (races, deadlock, starvation) you must design against.',
  },
  {
    key: 'building-blocks',
    title: 'Building Blocks',
    blurb:
      'The primitives: goroutines, channels, select, the sync package, atomics, and the memory model that makes them safe.',
  },
  {
    key: 'coordination',
    title: 'Coordination & Scale',
    blurb:
      'Putting the pieces together at scale — context cancellation, rate limiting, and propagating errors across goroutines.',
  },
  {
    key: 'runtime',
    title: 'The Runtime',
    blurb:
      "Under the hood — the M:N scheduler, work-stealing, GOMAXPROCS, the concurrent GC, and how goroutine stacks grow.",
  },
];

/** Data-structures-&-algorithms categories (the journey on /dsa/). */
export const DSA_CATEGORIES: CategoryMeta[] = [
  {
    key: 'complexity',
    title: 'Complexity & Big-O',
    blurb:
      'How to measure cost before you optimize — Big-O for time and space, amortized analysis, and reading the complexity of real Go code.',
  },
  {
    key: 'linear',
    title: 'Linear Structures',
    blurb:
      'The everyday building blocks — arrays and slices, strings, linked lists, stacks, queues and hash tables — and what each operation actually costs.',
  },
  {
    key: 'trees-graphs',
    title: 'Trees & Graphs',
    blurb:
      'Hierarchical and networked data — binary search trees, heaps and priority queues, tries, and graph traversal with BFS, DFS and friends.',
  },
  {
    key: 'algorithms',
    title: 'Algorithms & Patterns',
    blurb:
      'The reusable techniques — sorting, binary search, two pointers and sliding window, recursion and backtracking, dynamic programming and greedy.',
  },
];

export const REPO_URL = 'https://github.com/ehabterra/go-reference';
