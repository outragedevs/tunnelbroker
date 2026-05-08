import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log('Session endpoint - all cookies:', allCookies.map(c => c.name).join(', '));
    
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      authenticated: !!data.session,
      session: data.session ? {
        user: {
          id: data.session.user.id,
          email: data.session.user.email,
          user_metadata: data.session.user.user_metadata
        },
        expires_at: data.session.expires_at
      } : null,
      cookies: allCookies.map(c => ({ 
        name: c.name,
        value: c.name.includes('token') ? '[REDACTED]' : (c.value.substring(0, 20) + '...') 
      }))
    });
  } catch (e) {
    console.error('Error in session endpoint:', e);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
} 