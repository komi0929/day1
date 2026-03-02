import { createClient } from '@supabase/supabase-js';

// Database type definitions
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          streak: number;
          last_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          streak?: number;
          last_completed_at?: string | null;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          streak?: number;
          last_completed_at?: string | null;
        };
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          title: string;
          status: 'unread' | 'done';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          title?: string;
          status?: 'unread' | 'done';
        };
        Update: {
          url?: string;
          title?: string;
          status?: 'unread' | 'done';
        };
      };
      learning_sessions: {
        Row: {
          id: string;
          user_id: string;
          bookmark_id: string | null;
          memo_action: string;
          memo_question: string;
          memo_learning: string;
          ai_summary: string;
          ai_points: string[];
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bookmark_id?: string | null;
          memo_action?: string;
          memo_question?: string;
          memo_learning?: string;
          ai_summary?: string;
          ai_points?: string[];
        };
        Update: {
          memo_action?: string;
          memo_question?: string;
          memo_learning?: string;
          ai_summary?: string;
          ai_points?: string[];
        };
      };
    };
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const hasSupabase = supabaseUrl && supabaseAnonKey;

export const supabase = hasSupabase
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

export { hasSupabase };
