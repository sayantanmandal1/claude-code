// Polyfill for React's experimental useEffectEvent
// This provides a stable reference to a callback that always calls the latest version
import { useCallback, useRef, useLayoutEffect } from 'react'

export function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef<T>(callback)
  
  useLayoutEffect(() => {
    ref.current = callback
  })
  
  return useCallback(((...args) => {
    const fn = ref.current
    return fn(...args)
  }) as T, [])
}
