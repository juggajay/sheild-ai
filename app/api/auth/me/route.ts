import { NextRequest, NextResponse } from 'next/server'
import { getUserByToken, getUserByTokenAsync } from '@/lib/auth'
import { getDb, isProduction, getSupabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let user
    let company = null

    if (isProduction) {
      // Production: Use Supabase
      user = await getUserByTokenAsync(token)

      if (!user) {
        const response = NextResponse.json(
          { error: 'Session expired or invalid' },
          { status: 401 }
        )
        response.cookies.set('auth_token', '', {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 0,
          path: '/'
        })
        return response
      }

      // Get company info
      if (user.company_id) {
        const supabase = getSupabase()
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name, abn, logo_url, subscription_tier, subscription_status')
          .eq('id', user.company_id)
          .single()
        company = companyData
      }

    } else {
      // Development: Use SQLite
      user = getUserByToken(token)

      if (!user) {
        const response = NextResponse.json(
          { error: 'Session expired or invalid' },
          { status: 401 }
        )
        response.cookies.set('auth_token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 0,
          path: '/'
        })
        return response
      }

      // Get company info
      if (user.company_id) {
        const db = getDb()
        company = db.prepare(`
          SELECT id, name, abn, logo_url, subscription_tier, subscription_status
          FROM companies WHERE id = ?
        `).get(user.company_id)
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        company
      }
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
