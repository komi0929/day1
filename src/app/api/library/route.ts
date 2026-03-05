import { NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase';

export async function GET(req: Request) {
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

    // Fetch selections (history)
    const { data: selections } = await supabase
      .from('selections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch bookmarks
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      selections: selections || [],
      bookmarks: bookmarks || [],
    });
  } catch (error) {
    console.error('Library API error:', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
