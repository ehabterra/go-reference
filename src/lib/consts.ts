export const SITE_TITLE = 'Design Patterns, the Go Way';
export const SITE_DESC =
  'A visual, Go-first guide to every Gang-of-Four design pattern and Go’s essential concurrency patterns — with diagrams, runnable code, quizzes and progress tracking.';

export type CategoryKey =
  | 'foundations'
  | 'creational'
  | 'structural'
  | 'behavioral'
  | 'concurrency'
  | 'stdlib'
  | 'practice';

export interface CategoryMeta {
  key: CategoryKey;
  title: string;
  blurb: string;
}

/** Ordered categories shown on the landing page as the "journey". */
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

export const REPO_URL = 'https://github.com/ehabterra/design-patterns';
