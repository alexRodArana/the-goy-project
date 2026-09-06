import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from './useAppearance'

const choices = [
  { mode: 'system', label: 'Dispositivo', icon: Monitor },
  { mode: 'light', label: 'Claro', icon: Sun },
  { mode: 'dark', label: 'Oscuro', icon: Moon },
] as const

export function ThemeButton({ mode, onChange, onOpen }: { mode: ThemeMode; onChange: (mode: ThemeMode) => void; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const Icon = choices.find((choice) => choice.mode === mode)!.icon

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    container.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="theme-picker" ref={container}>
      <button aria-label="Elegir tema" aria-haspopup="menu" aria-expanded={open} className="icon-button" data-tooltip="Tema" type="button" ref={trigger} onClick={() => {
        if (!open) onOpen()
        setOpen((value) => !value)
      }}>
        <Icon size={18} />
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Tema" onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
          const current = items.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }}>
          {choices.map(({ mode: value, label, icon: OptionIcon }) => (
            <button key={value} type="button" role="menuitemradio" aria-checked={mode === value} onClick={() => {
              onChange(value)
              setOpen(false)
              trigger.current?.focus()
            }}>
              <OptionIcon size={17} /><span>{label}</span>{mode === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
