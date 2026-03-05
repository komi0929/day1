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

    const { noteUrl, noteTitle, noteBody, books, fragments } = await req.json();

    // Save selection
    const { data: selection, error: selErr } = await supabase.from('selections').insert({
      user_id: user.id,
      note_url: noteUrl || null,
      note_title: noteTitle || '',
      note_body_excerpt: (noteBody || '').slice(0, 500),
      books: books || [],
      fragments: fragments || [],
    }).select('id').single();

    if (selErr) {
      console.error('Save selection error:', selErr);
      return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ selectionId: selection.id });
  } catch (error) {
    console.error('Save selection API error:', error);
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }
}
