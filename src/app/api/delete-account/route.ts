import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/lib/security";

/**
 * DELETE /api/delete-account
 * ユーザー自身のアカウントを完全削除する。
 * CASCADE により profiles → bookmarks → learning_sessions も自動削除される。
 */
export async function DELETE(req: Request) {
  try {
    // 🔒 認証チェック — 本人確認
    const authResult = await authenticateRequest(req);
    if (authResult instanceof NextResponse) return authResult;

    const userId = authResult.user.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY for account deletion");
      return NextResponse.json(
        { error: "SERVER_CONFIG_ERROR", message: "サーバー設定エラーです。管理者にお問い合わせください。" },
        { status: 500 }
      );
    }

    // Admin クライアント（service_role キー使用）
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // auth.users から削除 → CASCADE で全データ削除
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Account deletion failed:", error.message);
      return NextResponse.json(
        { error: "DELETE_FAILED", message: "アカウントの削除に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "処理中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
