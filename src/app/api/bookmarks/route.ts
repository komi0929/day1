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

    const { book, selectionId } = await req.json();
    if (!book?.title || !book?.author) {
      return NextResponse.json({ error: 'INVALID_BOOK' }, { status: 400 });
    }

    // DB正規化済みカラム名でupsert（status/ai_processing_statusは送らない）
    const { error } = await supabase.from('bookmarks').upsert(
      {
        user_id: user.id,
        title: book.title,
        author: book.author,
        url: book.amazonUrl || '',
        image_url: book.thumbnail || '',
        label: book.label || '',
        summary: book.summary || '',
        letter: book.letter || '',
        rakuten_url: book.rakutenUrl || '',
        selection_id: selectionId || null,
      },
      { onConflict: 'user_id,title,author' }
    );

    if (error) {
      console.error('Bookmark upsert error:', JSON.stringify(error));
      return NextResponse.json({ error: 'BOOKMARK_FAILED', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bookmark API error:', error);
    return NextResponse.json({ error: 'BOOKMARK_FAILED' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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

    const { bookTitle, bookAuthor } = await req.json();

    const { error } = await supabase.from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('title', bookTitle)
      .eq('author', bookAuthor);

    if (error) {
      console.error('Bookmark delete error:', error);
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bookmark delete API error:', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
