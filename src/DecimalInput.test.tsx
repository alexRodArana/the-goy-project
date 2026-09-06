import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DecimalInput } from './DecimalInput'

function ControlledDecimalInput({ onValueChange = () => undefined }: { onValueChange?: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null)

  return (
    <DecimalInput
      ariaLabel="Peso"
      value={value}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        onValueChange(nextValue)
      }}
    />
  )
}

describe('DecimalInput', () => {
  it('preserves an intermediate decimal point while typing', () => {
    const onValueChange = vi.fn()
    render(<ControlledDecimalInput onValueChange={onValueChange} />)
    const input = screen.getByLabelText('Peso')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '82' } })
    fireEvent.change(input, { target: { value: '82.' } })
    expect(input).toHaveValue('82.')

    fireEvent.change(input, { target: { value: '82.5' } })
    expect(input).toHaveValue('82.5')
    expect(onValueChange).toHaveBeenLastCalledWith(82.5)
  })

  it('accepts a decimal comma and normalizes it after editing', () => {
    const onValueChange = vi.fn()
    render(<ControlledDecimalInput onValueChange={onValueChange} />)
    const input = screen.getByLabelText('Peso')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '72,25' } })
    expect(input).toHaveValue('72,25')
    expect(onValueChange).toHaveBeenLastCalledWith(72.25)

    fireEvent.blur(input)
    expect(input).toHaveValue('72.25')
  })

  it('ignores invalid characters and clears an empty value', () => {
    const onValueChange = vi.fn()
    render(<ControlledDecimalInput onValueChange={onValueChange} />)
    const input = screen.getByLabelText('Peso')

    fireEvent.change(input, { target: { value: '60.5' } })
    fireEvent.change(input, { target: { value: '60.5kg' } })
    expect(input).toHaveValue('60.5')

    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('')
    expect(onValueChange).toHaveBeenLastCalledWith(null)
  })
})
