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

/** Go-fundamentals categories (the journey on /fundamentals/). */
export const FUNDAMENTALS_CATEGORIES: CategoryMeta[] = [
  {
    key: 'basics',
    title: 'Basics & Syntax',
    blurb:
      'The ground floor — variables and zero values, the one loop, functions with multiple returns, and pointers without the footguns.',
  },
  {
    key: 'composite',
    title: 'Composite Types',
    blurb:
      'How Go groups data — structs, slices over a backing array, maps, and strings as UTF-8 bytes and runes.',
  },
  {
    key: 'types-methods',
    title: 'Methods & Interfaces',
    blurb:
      "Go's take on polymorphism — methods on any type, implicitly-satisfied interfaces, struct embedding, and generics.",
  },
  {
    key: 'idioms',
    title: 'Errors & Idioms',
    blurb:
      'The patterns that make code idiomatic — explicit errors and wrapping, defer/panic/recover, and packages and modules.',
  },
];

/** Standard-library-&-tooling categories (the journey on /stdlib/). */
export const STDLIB_CATEGORIES: CategoryMeta[] = [
  {
    key: 'essentials',
    title: 'Core Packages',
    blurb:
      'The packages you reach for daily — fmt and the io interfaces, strings and bytes, encoding/json, and working with time.',
  },
  {
    key: 'system',
    title: 'Files, CLI & Logging',
    blurb:
      'Talking to the outside world — reading and writing files with os, building command-line tools with flag, and structured logging with slog.',
  },
  {
    key: 'testing',
    title: 'Testing',
    blurb:
      "Go's batteries-included testing — the testing package, table-driven tests and subtests, fuzzing, and benchmarks.",
  },
  {
    key: 'tooling',
    title: 'Tooling & Profiling',
    blurb:
      'The toolchain that ships with Go — the go command and modules, profiling with pprof, and catching data races with the race detector.',
  },
];

/** Networking-&-web categories (the journey on /web/). */
export const WEB_CATEGORIES: CategoryMeta[] = [
  {
    key: 'net-basics',
    title: 'Sockets & the net Package',
    blurb:
      'The wire underneath everything — TCP and UDP with the net package, the Conn interface, and resolving names and addresses.',
  },
  {
    key: 'http',
    title: 'HTTP',
    blurb:
      'The web in net/http — writing servers and handlers, making client requests, routing and middleware, and serving over TLS.',
  },
  {
    key: 'apis',
    title: 'APIs & Messaging',
    blurb:
      'How services talk — JSON REST APIs, gRPC and protobuf, WebSockets for live connections, and Go’s own RPC and serialization.',
  },
  {
    key: 'data',
    title: 'Databases & Backend',
    blurb:
      'Persisting and structuring a service — database/sql, transactions, Postgres and Redis, project layout, and graceful shutdown.',
  },
];

/** Go-internals categories (the journey on /internals/). */
export const INTERNALS_CATEGORIES: CategoryMeta[] = [
  {
    key: 'memory',
    title: 'Memory & Garbage Collection',
    blurb:
      'Where values live and die — stack vs heap, escape analysis, the size-class allocator, and the concurrent tricolor garbage collector.',
  },
  {
    key: 'representation',
    title: 'Value Representation',
    blurb:
      'How Go lays out data in memory — struct padding and alignment, unsafe.Pointer and the rules around it, and the itab/eface behind every interface.',
  },
  {
    key: 'execution',
    title: 'Execution & Runtime',
    blurb:
      'How your program actually runs — the M:N goroutine scheduler down to sysmon and preemption, and observing the live runtime with metrics and GODEBUG.',
  },
  {
    key: 'toolchain',
    title: 'Compiler & Toolchain',
    blurb:
      'From source to binary — the compile and link pipeline, build modes and binary anatomy, and reading the assembly the compiler emits.',
  },
];

/** Systems-programming categories (the journey on /systems/). */
export const SYSTEMS_CATEGORIES: CategoryMeta[] = [
  {
    key: 'syscalls',
    title: 'The OS Interface',
    blurb:
      'Where Go meets the kernel — why Go suits systems work, system calls and the syscall/x/sys packages, file descriptors, and the standard streams.',
  },
  {
    key: 'files',
    title: 'Files & Directories',
    blurb:
      'Working the filesystem — permissions, walking directory trees, computing sizes and finding duplicates, symlinks, temp files, and crash-safe atomic writes.',
  },
  {
    key: 'processes',
    title: 'Processes & Events',
    blurb:
      'Programs that react — launching processes with os/exec, handling OS signals for graceful shutdown, and scheduling, tickers, and watching the filesystem for changes.',
  },
  {
    key: 'ipc',
    title: 'IPC & Sockets',
    blurb:
      'Talking between processes — anonymous and named pipes, Unix domain sockets (and HTTP over them), and memory-mapped files for zero-copy sharing.',
  },
];

/** Security categories (the journey on /security/). */
export const SECURITY_CATEGORIES: CategoryMeta[] = [
  {
    key: 'sec-foundations',
    title: 'Security Foundations',
    blurb:
      'The mindset before the tools — why Go is the language of modern security tooling, the rules of authorized testing, and how to build and ship a tool responsibly.',
  },
  {
    key: 'offensive',
    title: 'Recon & Offensive Testing',
    blurb:
      'How attacks actually work, so you can defend against them — port scanning, DNS and HTTP reconnaissance, fuzzing for bugs, and reading raw packets. Lab-scoped and defense-paired.',
  },
  {
    key: 'cryptography',
    title: 'Cryptography',
    blurb:
      "Go's crypto toolkit done right — hashing and password storage, authenticated symmetric encryption, TLS and PKI, and the classic mistakes that break weak crypto.",
  },
  {
    key: 'defense',
    title: 'Defensive Engineering',
    blurb:
      'Writing software that resists attack — input validation and injection defense, authentication and authorization, secrets management, and securing the supply chain.',
  },
];

/** Cloud-native categories (the journey on /cloud/). */
export const CLOUD_CATEGORIES: CategoryMeta[] = [
  {
    key: 'containers',
    title: 'Containers & Kubernetes',
    blurb:
      'Packaging and running Go in the cloud — tiny static images, the Kubernetes objects your service lives in, health probes and graceful lifecycle, and config from the environment.',
  },
  {
    key: 'observability',
    title: 'Config & Observability',
    blurb:
      "Seeing what your service does in production — 12-factor config, structured logs, Prometheus metrics, distributed tracing with OpenTelemetry, and profiling live.",
  },
  {
    key: 'messaging',
    title: 'Messaging & Data',
    blurb:
      'Decoupling services with events — message queues, event-driven architecture, the transactional outbox and idempotency, and caching with Redis.',
  },
  {
    key: 'resilience',
    title: 'Microservices & Resilience',
    blurb:
      'Building systems that stay up — service boundaries and gRPC, timeouts and retries, circuit breakers, load shedding, and distributed transactions with the saga pattern.',
  },
];

export const REPO_URL = 'https://github.com/ehabterra/go-reference';
