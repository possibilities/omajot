// Persistent storage for the replica (IndexedDB). Without it a site's storage
// is "best effort": under disk pressure the browser may clear it without
// asking. What reached the hub is safe either way; only changes made offline
// and not yet synced exist on this device alone.
//
// Chrome and Safari decide on navigator.storage.persist() without asking the
// user, so the app asks at startup. Firefox shows a prompt: there the app asks
// only when the user presses the button in the status dialog.

// 'persisted' | 'best-effort' | 'unknown' (the browser has no Storage API).
export async function storageState(nav = globalThis.navigator) {
  try {
    if (!nav?.storage?.persisted) return 'unknown'
    return (await nav.storage.persisted()) ? 'persisted' : 'best-effort'
  } catch {
    return 'unknown'
  }
}

// Ask the browser to keep the storage; the state afterwards.
export async function askPersist(nav = globalThis.navigator) {
  try {
    if (!nav?.storage?.persist) return 'unknown'
    if (await nav.storage.persisted()) return 'persisted'
    return (await nav.storage.persist()) ? 'persisted' : 'best-effort'
  } catch {
    return 'unknown'
  }
}

// Firefox asks the user; the others decide by themselves.
export function persistPrompts(ua = globalThis.navigator?.userAgent || '') {
  return /Firefox\//.test(ua)
}

// The storage line of the status dialog.
export function storageText(state) {
  if (state === 'persisted') return 'The browser keeps the notes on this device. It does not clear them to make space.'
  if (state === 'best-effort') return 'The browser may clear the notes on this device when the disk is full. Everything that reached the hub is safe; only changes made offline and not yet synced would be lost.'
  return 'This browser does not say if it keeps the notes on this device. Everything that reached the hub is safe.'
}
