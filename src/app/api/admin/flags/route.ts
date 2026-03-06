import { NextResponse } from 'next/server';

/**
 * Feature Flags CRUD API
 * GET: List all flags
 * PATCH: Update flag state
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 500 });

    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('feature_flags').select('*').order('id');
    if (error) throw error;

    return NextResponse.json({ flags: data || [] });
  } catch (error) {
    console.error('Flags GET error:', error);
    return NextResponse.json({ error: 'FAILED' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { id, enabled } = await req.json();
    if (!id || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 500 });

    const supabase = createClient(url, key);
    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Flags PATCH error:', error);
    return NextResponse.json({ error: 'FAILED' }, { status: 500 });
  }
}
