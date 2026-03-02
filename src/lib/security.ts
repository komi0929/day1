/**
 * セキュリティユーティリティ
 * SSRF防止、URLバリデーション、認証チェック
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * URLバリデーション — SSRF防止 + スキーム制限
 * httpsのみ許可、note.comドメインのみ許可、プライベートIP排除
 */
export function validateNoteUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // httpsのみ許可（javascript:, data:, file: 等を排除）
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'httpsのURLのみ対応しています。' };
    }

    // note.com ドメインのみ許可
    if (!parsed.hostname.endsWith('note.com')) {
      return { valid: false, error: '現在、noteの記事URLのみ対応しています。' };
    }

    // プライベートIP / localhost 排除
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.') ||
      host.startsWith('169.254.') ||
      host === '[::1]'
    ) {
      return { valid: false, error: '無効なURLです。' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'URLの形式が正しくありません。' };
  }
}

/**
 * APIルート認証チェック — Supabase JWTトークンを検証
 * 未認証の場合は401レスポンスを返す
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
