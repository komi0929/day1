import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAuthClient } from '@/lib/supabase';

const HEART_PROFILE_PROMPT = `あなたは心理カウンセラー兼編集者です。
以下のnote記事から、この著者の「今の心の状態」を200字程度で要約してください。

要約に含めるべき要素:
- 現在の悩みや課題感
- 大切にしている価値観
- まだ言葉にできていない願い
- 感情のトーン（焦り、希望、葛藤など）

※ この要約はユーザーには見せません。次回の選書で「この人を見守る専属編集者」として文脈を引き継ぐための内部メモです。
※ 機械的にならず、温かい観察者の視点で書いてください。
※ プレーンテキストのみで出力してください（JSON不要）。`;

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

    const { noteUrl, noteTitle, noteBody, selectionId } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !noteBody) {
      return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const prompt = `${HEART_PROFILE_PROMPT}\n\n━━━━━━━━━━━━━━━━\n■ note記事タイトル: ${noteTitle || '（タイトルなし）'}\n━━━━━━━━━━━━━━━━\n${(noteBody || '').trim().slice(0, 4000)}\n━━━━━━━━━━━━━━━━`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    // Save heart profile
    await supabase.from('heart_profiles').insert({
      user_id: user.id,
      selection_id: selectionId || null,
      note_url: noteUrl || null,
      summary,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Heart profile error:', error);
    // Non-critical — don't fail the user experience
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
