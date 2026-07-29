// Kept apart from the store so modules that only need an id (io, backup) do
// not have to import the reducer.
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
