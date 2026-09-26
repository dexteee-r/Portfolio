/**
 * File names become URLs: `content/projects/mytgc.yaml` → `/fr/dev/mytgc`.
 * Kept free of dependencies: client code (the view stage) reads it too.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
