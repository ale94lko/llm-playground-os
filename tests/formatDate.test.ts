import { describe, expect, it } from 'vitest'
import { formatDateTime } from '../app/lib/formatDate'

describe('formatDateTime', () => {
  it('formats with fixed locale', () => {
    const formatted = formatDateTime('2026-08-26T02:22:07.000Z')
    expect(formatted).toMatch(/Aug/)
    expect(formatted).toMatch(/26/)
  })

  it('returns input when date is invalid', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
