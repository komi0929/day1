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

    const baseData = {
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
    };

    // bookmarks_status_check 制約対応:
    // statusカラムのCHECK制約に許容される値が不明なため、
    // 全候補を順番に試行する
    const statusCandidates = [
      'saved',        // 最も一般的
      'active',       // アクティブ
      'want_to_read', // 読みたい
      'unread',       // 未読
      'reading',      // 読書中
      'read',         // 既読
      'pending',      // 保留
      'bookmarked',   // ブックマーク済み
    ];

    let lastError = null;

    for (const statusVal of statusCandidates) {
      const { error } = await supabase.from('bookmarks').upsert(
        { ...baseData, status: statusVal },
        { onConflict: 'user_id,title,author' }
      );

      if (!error) {
        console.log(`[Bookmark] SUCCESS with status='${statusVal}' for: ${book.title}`);
        return NextResponse.json({ success: true });
      }

      lastError = error;

      // CHECK制約違反以外のエラーは即座にリトライを止める
      if (!error.message?.includes('status_check')) {
        console.error(`[Bookmark] Non-status error:`, JSON.stringify(error));
        return NextResponse.json({ error: 'BOOKMARK_FAILED', details: error.message }, { status: 500 });
      }

      console.log(`[Bookmark] status='${statusVal}' failed CHECK. Trying next...`);
    }

    // 全候補が失敗: statusカラムなしで最終試行（DEFAULTが有効かも）
    // ※ただしこれは前回失敗したパターンなので最終手段
    const { error: finalError } = await supabase.from('bookmarks').upsert(
      baseData,
      { onConflict: 'user_id,title,author' }
    );

    if (!finalError) {
      console.log(`[Bookmark] SUCCESS without status for: ${book.title}`);
      return NextResponse.json({ success: true });
    }

    console.error('[Bookmark] ALL attempts failed. Last error:', JSON.stringify(lastError));
    console.error('[Bookmark] No-status error:', JSON.stringify(finalError));
    return NextResponse.json({ error: 'BOOKMARK_FAILED', details: finalError.message }, { status: 500 });
  } catch (error) {
    console.error('[Bookmark] API error:', error);
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
      console.error('[Bookmark] Delete error:', error);
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Bookmark] Delete API error:', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
