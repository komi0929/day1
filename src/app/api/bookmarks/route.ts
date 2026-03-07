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

    // 既存のブックマークを削除（重複防止）
    await supabase.from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('book_title', book.title)
      .eq('book_author', book.author);

    // 最小限のカラムで挿入（DBスキーマに依存しない）
    const basicData: Record<string, unknown> = {
      user_id: user.id,
      book_title: book.title,
      book_author: book.author,
    };

    // オプションカラムを試行
    const optionalFields: Record<string, unknown> = {
      selection_id: selectionId || null,
      book_label: book.label || '',
      book_summary: book.summary || '',
      book_letter: book.letter || '',
      book_thumbnail: book.thumbnail || '',
      book_amazon_url: book.amazonUrl || '',
      book_rakuten_url: book.rakutenUrl || '',
    };

    // まず全フィールドで試行
    const { error: fullError } = await supabase.from('bookmarks').insert({ ...basicData, ...optionalFields });
    
    if (fullError) {
      console.warn('Full insert failed, trying minimal:', fullError.message);
      // 失敗したら最小限で試行
      const { error: minError } = await supabase.from('bookmarks').insert(basicData);
      if (minError) {
        console.error('Minimal insert also failed:', JSON.stringify(minError));
        return NextResponse.json({ error: 'BOOKMARK_FAILED', details: minError.message }, { status: 500 });
      }
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
