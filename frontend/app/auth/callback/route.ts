import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Użyj stałego site URL zamiast origin z zapytania
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tb.tahio.eu'

  if (code) {
    console.log('Code found, exchanging for session')
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Przekieruj zawsze do pełnego URL z NEXT_PUBLIC_SITE_URL
      const redirectTo = `${siteUrl}${next}`
      console.log('Redirecting to:', redirectTo)
      return NextResponse.redirect(redirectTo)
    } else {
      console.error('Exchange error:', error.message)
    }
  } else {
    console.log('No code param found in URL')
  }

  // Return the user to an error page with some instructions
  console.log('Redirecting to error page')
  return NextResponse.redirect(`${siteUrl}/error`)
}