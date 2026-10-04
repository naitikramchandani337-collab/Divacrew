/**
 * Placeholder database type definitions.
 * These will be replaced by the generated types from Supabase CLI once
 * migrations are applied: `supabase gen types typescript --local > lib/supabase/database.types.ts`
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          avatar_url: string | null;
          city: string | null;
          age_bracket: 'minor' | 'adult';
          verification_status: 'unverified' | 'pending' | 'verified';
          profile_visibility: 'public' | 'private';
          dm_permissions: 'everyone' | 'connections' | 'nobody';
          location_sharing: boolean;
          inviter_id: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          avatar_url?: string | null;
          city?: string | null;
          age_bracket: 'minor' | 'adult';
          verification_status?: 'unverified' | 'pending' | 'verified';
          profile_visibility?: 'public' | 'private';
          dm_permissions?: 'everyone' | 'connections' | 'nobody';
          location_sharing?: boolean;
          inviter_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string;
          avatar_url?: string | null;
          city?: string | null;
          age_bracket?: 'minor' | 'adult';
          verification_status?: 'unverified' | 'pending' | 'verified';
          profile_visibility?: 'public' | 'private';
          dm_permissions?: 'everyone' | 'connections' | 'nobody';
          location_sharing?: boolean;
          inviter_id?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      invites: {
        Row: {
          id: string;
          code: string;
          owner_id: string;
          redeemed_by: string | null;
          redeemed_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          owner_id: string;
          redeemed_by?: string | null;
          redeemed_at?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          redeemed_by?: string | null;
          redeemed_at?: string | null;
          expires_at?: string;
        };
      };
      consents: {
        Row: {
          id: string;
          user_id: string;
          privacy_notice_version: string;
          age_bracket: 'minor' | 'adult';
          accepted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          privacy_notice_version: string;
          age_bracket: 'minor' | 'adult';
          accepted_at?: string;
          created_at?: string;
        };
        Update: never;
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: never;
      };
      contact_requests: {
        Row: {
          id: string;
          requester_id: string;
          target_id: string;
          status: 'pending' | 'accepted' | 'rejected';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          target_id: string;
          status?: 'pending' | 'accepted' | 'rejected';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'rejected';
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_consent: {
        Args: {
          p_user_id: string;
          p_version: string;
          p_age_bracket: 'minor' | 'adult';
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
};
