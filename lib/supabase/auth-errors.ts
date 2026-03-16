export function isMissingSessionError(message?: string | null) {
  if (!message) {
    return false
  }

  const normalized = message.toLowerCase()
  return (
    normalized.includes('auth session missing') ||
    normalized.includes('session from storage was not found')
  )
}

export function formatDatabaseActionError(message?: string | null) {
  if (!message) {
    return 'Database operation failed'
  }

  if (message.toLowerCase().includes('row-level security')) {
    return 'Database policy blocked this action. Run scripts/03-fix-rls-policies.sql in the Supabase SQL Editor, then sign in again.'
  }

  return message
}