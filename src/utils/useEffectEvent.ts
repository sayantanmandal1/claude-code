// Polyfill for React's experimental useEffectEvent
// This provides a stable reference to a callback that always calls the latest version
// Renamed to useStableCallback to avoid name collision with React 19's
// built-in useEffectEvent (which calls resolveDispatcher().useEffectEvent
// and fails because the custom Ink reconciler doesn't implement it).
import { useCallback, useRef, useLayoutEffect } from 'react'

export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef<T>(callback)
  
  useLayoutEffect(() => {
    ref.current = callback
  })
  
  return useCallback(((...args) => {
    const fn = ref.current
    return fn(...args)
  }) as T, [])
}
