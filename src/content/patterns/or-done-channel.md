---
title: "Or-done Channel"
slug: or-done-channel
category: concurrency
kind: pattern
order: 29
difficulty: "Intermediate"
status: stub
intent: "Wrap a stream so it stops cleanly the moment a done or cancel signal fires."
nutshell: "Avoid goroutine leaks by making every receive also watch for cancellation."
---

