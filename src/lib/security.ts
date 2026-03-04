/**
 * セキュリティユーティリティ
 * 認証チェック
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * APIルート認証チェック — Supabase JWTトークンを検証
 */
export async function authenticateRequest(
  req: Request
): Promise<{ user: { id: string } } | NextResponse> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '認証が必要です。' },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'SERVER_CONFIG_ERROR', message: 'サーバー設定エラーです。' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '認証が無効です。再ログインしてください。' },
      { status: 401 }
    );
  }

  return { user: { id: user.id } };
}
