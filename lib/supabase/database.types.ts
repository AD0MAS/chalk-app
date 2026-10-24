export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bank_connection: {
        Row: {
          accounts: Json
          aspsp_name: string | null
          bank_calls: Json
          connected_at: string | null
          import_approved_at: string | null
          last_attempt_at: string | null
          last_error: string | null
          last_imported: number | null
          last_sync_at: string | null
          owner_id: string
          retry_after: string | null
          session_id: string | null
          sync_lock_until: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accounts?: Json
          aspsp_name?: string | null
          bank_calls?: Json
          connected_at?: string | null
          import_approved_at?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          last_imported?: number | null
          last_sync_at?: string | null
          owner_id: string
          retry_after?: string | null
          session_id?: string | null
          sync_lock_until?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accounts?: Json
          aspsp_name?: string | null
          bank_calls?: Json
          connected_at?: string | null
          import_approved_at?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          last_imported?: number | null
          last_sync_at?: string | null
          owner_id?: string
          retry_after?: string | null
          session_id?: string | null
          sync_lock_until?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      gaps: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          resolved_at: string | null
          student_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          resolved_at?: string | null
          student_id: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          resolved_at?: string | null
          student_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaps_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "gaps_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      gcal_deletions: {
        Row: {
          created_at: string
          error: string | null
          id: number
          lesson_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          lesson_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          lesson_id?: string
          owner_id?: string
        }
        Relationships: []
      }
      google_connection: {
        Row: {
          calendar_id: string | null
          connected_at: string | null
          last_error: string | null
          last_sync_at: string | null
          owner_id: string
          refresh_token: string | null
          scope: string | null
          sync_lock_until: string | null
          updated_at: string
        }
        Insert: {
          calendar_id?: string | null
          connected_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          owner_id: string
          refresh_token?: string | null
          scope?: string | null
          sync_lock_until?: string | null
          updated_at?: string
        }
        Update: {
          calendar_id?: string | null
          connected_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          owner_id?: string
          refresh_token?: string | null
          scope?: string | null
          sync_lock_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      historical_income: {
        Row: {
          amount: number
          created_at: string
          id: string
          import_key: string | null
          note: string | null
          owner_id: string
          payer_name: string | null
          received_on: string
          source: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          import_key?: string | null
          note?: string | null
          owner_id?: string
          payer_name?: string | null
          received_on: string
          source: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          import_key?: string | null
          note?: string | null
          owner_id?: string
          payer_name?: string | null
          received_on?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_notes: {
        Row: {
          created_at: string
          done: string | null
          homework: string | null
          id: string
          lesson_id: string
          next_start: string | null
          owner_id: string
          stopped_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: string | null
          homework?: string | null
          id?: string
          lesson_id: string
          next_start?: string | null
          owner_id?: string
          stopped_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: string | null
          homework?: string | null
          id?: string
          lesson_id?: string
          next_start?: string | null
          owner_id?: string
          stopped_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons_view"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          duration_minutes: number
          gcal_dirty: boolean
          gcal_error: string | null
          gcal_event_id: string | null
          gcal_version: number
          id: string
          kind: Database["public"]["Enums"]["lesson_kind"]
          original_starts_at: string | null
          owner_id: string
          price: number
          slot_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          gcal_dirty?: boolean
          gcal_error?: string | null
          gcal_event_id?: string | null
          gcal_version?: number
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          original_starts_at?: string | null
          owner_id?: string
          price: number
          slot_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          gcal_dirty?: boolean
          gcal_error?: string | null
          gcal_event_id?: string | null
          gcal_version?: number
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          original_starts_at?: string | null
          owner_id?: string
          price?: number
          slot_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_aliases: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          payer_iban: string | null
          payer_name: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          payer_iban?: string | null
          payer_name?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          payer_iban?: string | null
          payer_name?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_aliases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payer_aliases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          booked_on: string
          created_at: string
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          note: string | null
          owner_id: string
          payer_iban: string | null
          payer_name: string | null
          remittance: string | null
          source: Database["public"]["Enums"]["payment_source"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          booked_on: string
          created_at?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          payer_iban?: string | null
          payer_name?: string | null
          remittance?: string | null
          source?: Database["public"]["Enums"]["payment_source"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          booked_on?: string
          created_at?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          payer_iban?: string | null
          payer_name?: string | null
          remittance?: string | null
          source?: Database["public"]["Enums"]["payment_source"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          start_time: string
          student_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          start_time: string
          student_id: string
          updated_at?: string
          valid_from: string
          valid_to?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          start_time?: string
          student_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "schedule_slots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          owner_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          owner_id?: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          owner_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      student_status_history: {
        Row: {
          created_at: string
          id: string
          note: string | null
          owner_id: string
          status: Database["public"]["Enums"]["student_status"]
          student_id: string
          valid_from: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          status: Database["public"]["Enums"]["student_status"]
          student_id: string
          valid_from: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          student_id?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_status_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_status_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          board_url: string | null
          created_at: string
          first_name: string
          grade: number
          id: string
          last_name: string | null
          math_level: Database["public"]["Enums"]["math_level"] | null
          meet_url: string | null
          notes: string | null
          opening_balance: number
          owner_id: string
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          price: number
          status: Database["public"]["Enums"]["student_status"]
          student_email: string | null
          student_phone: string | null
          tone: Database["public"]["Enums"]["student_tone"]
          updated_at: string
        }
        Insert: {
          board_url?: string | null
          created_at?: string
          first_name: string
          grade: number
          id?: string
          last_name?: string | null
          math_level?: Database["public"]["Enums"]["math_level"] | null
          meet_url?: string | null
          notes?: string | null
          opening_balance?: number
          owner_id?: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          price: number
          status?: Database["public"]["Enums"]["student_status"]
          student_email?: string | null
          student_phone?: string | null
          tone?: Database["public"]["Enums"]["student_tone"]
          updated_at?: string
        }
        Update: {
          board_url?: string | null
          created_at?: string
          first_name?: string
          grade?: number
          id?: string
          last_name?: string | null
          math_level?: Database["public"]["Enums"]["math_level"] | null
          meet_url?: string | null
          notes?: string | null
          opening_balance?: number
          owner_id?: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          price?: number
          status?: Database["public"]["Enums"]["student_status"]
          student_email?: string | null
          student_phone?: string | null
          tone?: Database["public"]["Enums"]["student_tone"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      lessons_view: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          duration_minutes: number | null
          effective_status: Database["public"]["Enums"]["lesson_status"] | null
          id: string | null
          kind: Database["public"]["Enums"]["lesson_kind"] | null
          original_starts_at: string | null
          owner_id: string | null
          price: number | null
          slot_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["lesson_status"] | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          effective_status?: never
          id?: string | null
          kind?: Database["public"]["Enums"]["lesson_kind"] | null
          original_starts_at?: string | null
          owner_id?: string | null
          price?: number | null
          slot_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["lesson_status"] | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          effective_status?: never
          id?: string | null
          kind?: Database["public"]["Enums"]["lesson_kind"] | null
          original_starts_at?: string | null
          owner_id?: string | null
          price?: number | null
          slot_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["lesson_status"] | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_balances: {
        Row: {
          balance: number | null
          charged: number | null
          held_count: number | null
          opening_balance: number | null
          paid: number | null
          student_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_lessons: { Args: never; Returns: number }
      lessons_horizon: { Args: { p_day: string }; Returns: string }
      prune_planned_lessons: {
        Args: { p_from: string; p_slot_id: string }
        Returns: number
      }
      reschedule_series: {
        Args: { p_lesson_id: string; p_new_start: string }
        Returns: string
      }
    }
    Enums: {
      lesson_kind: "regular" | "one_off"
      lesson_status: "suplanuota" | "ivyko" | "atsaukta"
      math_level: "A" | "B"
      payment_source: "bank" | "manual" | "csv"
      student_status:
        | "derinama"
        | "pastovus"
        | "nepastovus"
        | "pauze"
        | "archyvuotas"
      student_tone:
        | "sky"
        | "sage"
        | "clay"
        | "lavender"
        | "sand"
        | "rose"
        | "mist"
        | "apricot"
        | "plum"
        | "slate"
        | "moss"
        | "coral"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      lesson_kind: ["regular", "one_off"],
      lesson_status: ["suplanuota", "ivyko", "atsaukta"],
      math_level: ["A", "B"],
      payment_source: ["bank", "manual", "csv"],
      student_status: [
        "derinama",
        "pastovus",
        "nepastovus",
        "pauze",
        "archyvuotas",
      ],
      student_tone: [
        "sky",
        "sage",
        "clay",
        "lavender",
        "sand",
        "rose",
        "mist",
        "apricot",
        "plum",
        "slate",
        "moss",
        "coral",
      ],
    },
  },
} as const
