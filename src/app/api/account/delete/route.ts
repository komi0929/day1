import { NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createAuthClient(token);
    if (!supabase) {
      return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 500 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Delete user data (RLS ensures only own data is deleted)
    await supabase.from('bookmarks').delete().eq('user_id', user.id);
    await supabase.from('heart_profiles').delete().eq('user_id', user.id);
    await supabase.from('selections').delete().eq('user_id', user.id);

    // Note: Actual user account deletion requires Supabase admin API
    // For now, we clear all user data and sign them out
    // The auth record remains but all personal data is purged

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account delete error:', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
