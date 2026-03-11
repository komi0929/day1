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

    // Step 1: まずDBの実際のカラム名を取得
    const { data: columns, error: colError } = await supabase
      .from('bookmarks')
      .select('*')
      .limit(0);

    // カラム取得失敗時のログ
    if (colError) {
      console.error('[Bookmark] Schema check error:', colError.message);
    }

    // Step 2: 基本データ（確実に存在するカラムのみ）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseData: Record<string, any> = {
      user_id: user.id,
    };

    // カラム名のマッピング候補（正規化済みと旧名の両方を試行）
    // DBの実カラム名を動的に検出
    const columnNames = columns ? Object.keys(columns[0] || {}) : [];
    console.log('[Bookmark] Detected DB columns:', columnNames.length > 0 ? columnNames.join(', ') : 'empty table, using guess');

    // タイトルカラム判定
    if (columnNames.includes('title') || columnNames.length === 0) {
      baseData.title = book.title;
      baseData.author = book.author;
    } else if (columnNames.includes('book_title')) {
      baseData.book_title = book.title;
      baseData.book_author = book.author;
    }

    // オプションカラム（存在する場合のみ設定）
    const optionalMappings = [
      { normalized: 'url', old: 'book_amazon_url', value: book.amazonUrl || '' },
      { normalized: 'image_url', old: 'book_thumbnail', value: book.thumbnail || '' },
      { normalized: 'label', old: 'book_label', value: book.label || '' },
      { normalized: 'summary', old: 'book_summary', value: book.summary || '' },
      { normalized: 'letter', old: 'book_letter', value: book.letter || '' },
      { normalized: 'rakuten_url', old: null, value: book.rakutenUrl || '' },
    ];

    for (const mapping of optionalMappings) {
      if (columnNames.length === 0) {
        // テーブルが空の場合、正規化名を優先
        baseData[mapping.normalized] = mapping.value;
      } else if (columnNames.includes(mapping.normalized)) {
        baseData[mapping.normalized] = mapping.value;
      } else if (mapping.old && columnNames.includes(mapping.old)) {
        baseData[mapping.old] = mapping.value;
      }
      // どちらも存在しなければスキップ
    }

    // selection_id
    if (columnNames.length === 0 || columnNames.includes('selection_id')) {
      baseData.selection_id = selectionId || null;
    }

    // onConflict のカラム名も動的に決定
    const titleCol = columnNames.includes('book_title') ? 'book_title' : 'title';
    const authorCol = columnNames.includes('book_author') ? 'book_author' : 'author';
    const conflictStr = `user_id,${titleCol},${authorCol}`;

    console.log('[Bookmark] Upsert data keys:', Object.keys(baseData).join(', '));
    console.log('[Bookmark] onConflict:', conflictStr);

    const { error } = await supabase.from('bookmarks').upsert(
      baseData,
      { onConflict: conflictStr }
    );

    if (error) {
      console.error('[Bookmark] Upsert FAILED:', JSON.stringify(error));
      return NextResponse.json({ error: 'BOOKMARK_FAILED', details: error.message }, { status: 500 });
    }

    console.log('[Bookmark] Upsert SUCCESS for:', book.title);
    return NextResponse.json({ success: true });
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

    // 両方のカラム名で試行
    let result = await supabase.from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('title', bookTitle)
      .eq('author', bookAuthor);

    if (result.error) {
      // 旧カラム名でリトライ
      result = await supabase.from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('book_title', bookTitle)
        .eq('book_author', bookAuthor);
    }

    if (result.error) {
      console.error('[Bookmark] Delete error:', result.error);
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Bookmark] Delete API error:', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
