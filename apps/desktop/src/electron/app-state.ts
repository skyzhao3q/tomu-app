/** Shared mutable state for the Electron main process. */
export let isQuitting = false;

export function setQuitting(value: boolean): void {
  isQuitting = value;
}
