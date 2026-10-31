'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copy text and expose a short-lived `copied` flag for the button label.
 * `copied` only flips once the clipboard write actually resolves — writes can be denied
 * (permissions, insecure context), and a false "Copied" on a show-once API key loses it.
 */
export function useCopyToClipboard(resetMs = 1800) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    (text: string) => {
      if (!text || !navigator.clipboard) return
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), resetMs)
        })
        .catch(() => setCopied(false))
    },
    [resetMs],
  )

  return { copied, copy }
}
