---
title: "errgroup"
slug: errgroup
category: concurrency
kind: pattern
order: 32
difficulty: "Intermediate"
status: stub
intent: "Run a group of goroutines, wait for them all, and capture the first error with automatic cancellation."
nutshell: "`x/sync/errgroup` is a WaitGroup plus a shared error and context cancel — the go-to for concurrent fan-out that can fail."
---

