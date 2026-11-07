export function formatPrice(price: number): string {
  if (price <= 0) return 'Free'
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** "Alex R." or "Alex Rivera" depending on privacy preference. */
export function displayName(user: { firstName: string; lastName: string; privacy?: { showFullName: boolean } }): string {
  if (user.privacy?.showFullName) return `${user.firstName} ${user.lastName}`.trim()
  return user.lastName ? `${user.firstName} ${user.lastName.charAt(0)}.` : user.firstName
}

export function initials(user: { firstName: string; lastName: string }): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
