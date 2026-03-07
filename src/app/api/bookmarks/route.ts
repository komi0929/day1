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

    const { error } = await supabase.from('bookmarks').upsert({
      user_id: user.id,
      selection_id: selectionId || null,
      book_title: book.title,
      book_author: book.author,
      book_label: book.label || '',
      book_headline: book.headline || '',
      book_oneliner: book.oneliner || '',
      book_summary: book.summary || '',
      book_letter: book.letter || '',
      book_thumbnail: book.thumbnail || '',
      book_amazon_url: book.amazonUrl || '',
      book_rakuten_url: book.rakutenUrl || '',
    }, { onConflict: 'user_id,book_title,book_author' });

    if (error) {
      console.error('Bookmark error:', error);
      return NextResponse.json({ error: 'BOOKMARK_FAILED' }, { status: 500 });
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
      .eq('book_title', bookTitle)
      .eq('book_author', bookAuthor);

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
