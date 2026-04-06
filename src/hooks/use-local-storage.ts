'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook para armazenar estado no localStorage com hidratação segura (SSR).
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // Lê o valor após a hidratação (evita discrepância server/client)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T)
      }
    } catch {
      // Ignora erros de localStorage em ambientes sem acesso
    }
  }, [key])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch {
        // Ignora
      }
    },
    [key, storedValue],
  )

  return [storedValue, setValue]
}
