import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'signallab-theme'
const LEGACY_KEY = 'bb_theme'

let initialized = false
let currentTheme = 'dark'
const listeners = new Set()

function isValidTheme(value) {
  return value === 'dark' || value === 'light'
}

function readThemeFromStorage(key) {
  try {
    const v = localStorage.getItem(key)
    return isValidTheme(v) ? v : null
  } catch {
    return null
  }
}

function resolveInitialTheme() {
  const saved = readThemeFromStorage(STORAGE_KEY)
  if (saved) return saved

  const legacy = readThemeFromStorage(LEGACY_KEY)
  if (legacy) return legacy

  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return prefersDark ? 'dark' : 'light'
    }
  } catch {
    /* ignore */
  }

  return 'dark'
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return

  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
    return
  }

  root.classList.add('light')
  root.classList.remove('dark')
}

function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LEGACY_KEY, theme)
  } catch {
    /* ignore */
  }
}

function notify(next) {
  listeners.forEach((fn) => fn(next))
}

export function initTheme() {
  if (initialized) return currentTheme
  initialized = true
  currentTheme = resolveInitialTheme()
  applyThemeToDocument(currentTheme)
  persistTheme(currentTheme)
  return currentTheme
}

function setThemeInternal(next) {
  const t = isValidTheme(next) ? next : 'dark'
  if (!initialized) initTheme()
  if (t === currentTheme) return

  currentTheme = t
  applyThemeToDocument(currentTheme)
  persistTheme(currentTheme)
  notify(currentTheme)
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return initTheme()
  })

  useEffect(() => {
    const handler = (next) => setThemeState(next)
    listeners.add(handler)
    return () => listeners.delete(handler)
  }, [])

  const setTheme = useCallback((next) => {
    setThemeInternal(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeInternal(currentTheme === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme, isDark: theme === 'dark', toggleTheme, setTheme }
}

