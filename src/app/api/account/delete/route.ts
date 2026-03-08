import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

    const userId = user.id;
    console.log(`[Account Delete] Starting full data deletion for user: ${userId}`);

    // Phase 1: Delete all user data from every table (RLS ensures only own data)
    const deleteResults = await Promise.allSettled([
      supabase.from('bookmarks').delete().eq('user_id', userId),
      supabase.from('heart_profiles').delete().eq('user_id', userId),
      supabase.from('selections').delete().eq('user_id', userId),
      supabase.from('profiles').delete().eq('id', userId),
      supabase.from('analytics_events').delete().eq('user_id', userId),
    ]);

    // Log any failures (non-critical — table might not exist)
    deleteResults.forEach((result, i) => {
      const tables = ['bookmarks', 'heart_profiles', 'selections', 'profiles', 'analytics_events'];
      if (result.status === 'rejected') {
        console.warn(`[Account Delete] ${tables[i]} delete failed:`, result.reason);
      } else if (result.value?.error) {
        console.warn(`[Account Delete] ${tables[i]} delete error:`, result.value.error.message);
      } else {
        console.log(`[Account Delete] ${tables[i]} deleted successfully`);
      }
    });

    // Phase 2: Delete Supabase auth user using admin API (requires service role key)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceRoleKey && supabaseUrl) {
      try {
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteUserError) {
          console.error(`[Account Delete] Auth user deletion failed:`, deleteUserError.message);
        } else {
          console.log(`[Account Delete] Auth user ${userId} deleted successfully`);
        }
      } catch (adminErr) {
        console.error(`[Account Delete] Admin API error:`, adminErr);
      }
    } else {
      console.warn(`[Account Delete] SUPABASE_SERVICE_ROLE_KEY not set — auth record not deleted`);
    }

    console.log(`[Account Delete] Completed for user: ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account delete error:', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
}
