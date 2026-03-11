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

    // 実際のDBカラム名に合わせたupsert
    const { error } = await supabase.from('bookmarks').upsert({
      user_id: user.id,
      title: book.title,           // DB: title (text, NOT NULL)
      author: book.author,         // DB: author (text, DEFAULT '')
      url: book.amazonUrl || '',   // DB: url (text, NOT NULL → DEFAULT '')
      image_url: book.thumbnail || '',  // DB: image_url (text)
      label: book.label || '',     // DB: label (text, DEFAULT '')
      summary: book.summary || '', // DB: summary (text, DEFAULT '')
      letter: book.letter || '',   // DB: letter (text, DEFAULT '')
      rakuten_url: book.rakutenUrl || '', // DB: rakuten_url (text, DEFAULT '')
      selection_id: selectionId || null,  // DB: selection_id (uuid)
    }, { onConflict: 'user_id,title,author' });

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

    // 実際のDBカラム名で削除
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
