import { useEffect, useRef, useState } from 'react'

type DecimalInputProps = {
  ariaLabel: string
  placeholder?: string
  value: number | null | undefined
  onValueChange: (value: number | null) => void
}

const editableDecimalPattern = /^\d*(?:[.,]\d*)?$/

const formatDecimal = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? '' : String(value)

const parseDecimal = (text: string) => {
  let normalized = text.replace(',', '.')

  if (normalized.startsWith('.')) {
    normalized = `0${normalized}`
  }

  if (!/^(?:\d+|\d*\.\d+)$/.test(normalized)) {
    return undefined
  }

  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function DecimalInput({ ariaLabel, placeholder, value, onValueChange }: DecimalInputProps) {
  const [draft, setDraft] = useState(() => formatDecimal(value))
  const isFocused = useRef(false)

  useEffect(() => {
    if (!isFocused.current) {
      setDraft(formatDecimal(value))
    }
  }, [value])

  return (
    <input
      aria-label={ariaLabel}
      autoComplete="off"
      enterKeyHint="done"
      inputMode="decimal"
      pattern="[0-9]*([.,][0-9]*)?"
      placeholder={placeholder}
      spellCheck={false}
      type="text"
      value={draft}
      onBlur={() => {
        isFocused.current = false
        const parsed = parseDecimal(draft.replace(/[.,]$/, ''))
        const nextValue = parsed ?? null
        setDraft(formatDecimal(nextValue))
        if (nextValue !== value) {
          onValueChange(nextValue)
        }
      }}
      onChange={(event) => {
        const nextDraft = event.target.value

        if (!editableDecimalPattern.test(nextDraft)) {
          return
        }

        setDraft(nextDraft)

        if (nextDraft === '') {
          onValueChange(null)
          return
        }

        const parsed = parseDecimal(nextDraft)
        if (parsed !== undefined) {
          onValueChange(parsed)
        }
      }}
      onFocus={(event) => {
        isFocused.current = true
        event.currentTarget.select()
      }}
    />
  )
}
