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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      change_batches: {
        Row: {
          course_id: string
          created_at: string
          id: string
          request_text: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          request_text: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          request_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      change_proposals: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          is_sensitive: boolean
          item_id: string
          kind: string
          proposed_state: Json
          rationale: string
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          item_id: string
          kind: string
          proposed_state: Json
          rationale: string
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          item_id?: string
          kind?: string
          proposed_state?: Json
          rationale?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_proposals_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "change_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_proposals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "module_items"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          canvas_course_id: string
          created_at: string
          expires_at: string
          id: string
          import_issues: Json
          import_status: string
          imported_at: string
          name: string
          raw_payload: Json
          schema_version: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          canvas_course_id: string
          created_at?: string
          expires_at?: string
          id?: string
          import_issues?: Json
          import_status?: string
          imported_at?: string
          name: string
          raw_payload?: Json
          schema_version?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          canvas_course_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          import_issues?: Json
          import_status?: string
          imported_at?: string
          name?: string
          raw_payload?: Json
          schema_version?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          canvas_file_id: string
          content_type: string | null
          course_id: string
          created_at: string
          display_name: string
          id: string
          links: Json
          module_item_id: string | null
          raw_payload: Json
          updated_at: string
          url: string
        }
        Insert: {
          canvas_file_id: string
          content_type?: string | null
          course_id: string
          created_at?: string
          display_name: string
          id?: string
          links?: Json
          module_item_id?: string | null
          raw_payload?: Json
          updated_at?: string
          url?: string
        }
        Update: {
          canvas_file_id?: string
          content_type?: string | null
          course_id?: string
          created_at?: string
          display_name?: string
          id?: string
          links?: Json
          module_item_id?: string | null
          raw_payload?: Json
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_module_item_id_fkey"
            columns: ["module_item_id"]
            isOneToOne: false
            referencedRelation: "module_items"
            referencedColumns: ["id"]
          },
        ]
      }
      module_items: {
        Row: {
          canvas_module_item_id: string
          created_at: string
          id: string
          kind: string
          links: Json
          module_id: string
          opaque: Json | null
          position: number
          raw_payload: Json
          updated_at: string
        }
        Insert: {
          canvas_module_item_id: string
          created_at?: string
          id?: string
          kind: string
          links?: Json
          module_id: string
          opaque?: Json | null
          position?: number
          raw_payload?: Json
          updated_at?: string
        }
        Update: {
          canvas_module_item_id?: string
          created_at?: string
          id?: string
          kind?: string
          links?: Json
          module_id?: string
          opaque?: Json | null
          position?: number
          raw_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          canvas_module_id: string
          course_id: string
          created_at: string
          id: string
          name: string
          position: number
          raw_payload: Json
          updated_at: string
        }
        Insert: {
          canvas_module_id: string
          course_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          raw_payload?: Json
          updated_at?: string
        }
        Update: {
          canvas_module_id?: string
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          raw_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          body_html: string
          canvas_page_id: string | null
          created_at: string
          front_page: boolean | null
          id: string
          links: Json
          module_item_id: string
          page_url: string
          published: boolean | null
          raw_payload: Json
          title: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          canvas_page_id?: string | null
          created_at?: string
          front_page?: boolean | null
          id?: string
          links?: Json
          module_item_id: string
          page_url: string
          published?: boolean | null
          raw_payload?: Json
          title: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          canvas_page_id?: string | null
          created_at?: string
          front_page?: boolean | null
          id?: string
          links?: Json
          module_item_id?: string
          page_url?: string
          published?: boolean | null
          raw_payload?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_module_item_id_fkey"
            columns: ["module_item_id"]
            isOneToOne: true
            referencedRelation: "module_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          canvas_answer_id: string | null
          comments_html: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          ordinal: number
          question_id: string
          raw_payload: Json
          text_html: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          canvas_answer_id?: string | null
          comments_html?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          ordinal?: number
          question_id: string
          raw_payload?: Json
          text_html?: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          canvas_answer_id?: string | null
          comments_html?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          ordinal?: number
          question_id?: string
          raw_payload?: Json
          text_html?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          canvas_question_id: string
          created_at: string
          id: string
          links: Json
          points_possible: number | null
          position: number
          question_type: string
          quiz_id: string
          raw_payload: Json
          read_only_reason: string | null
          stem_html: string
          type_specific: Json
          updated_at: string
        }
        Insert: {
          canvas_question_id: string
          created_at?: string
          id?: string
          links?: Json
          points_possible?: number | null
          position?: number
          question_type: string
          quiz_id: string
          raw_payload?: Json
          read_only_reason?: string | null
          stem_html?: string
          type_specific?: Json
          updated_at?: string
        }
        Update: {
          canvas_question_id?: string
          created_at?: string
          id?: string
          links?: Json
          points_possible?: number | null
          position?: number
          question_type?: string
          quiz_id?: string
          raw_payload?: Json
          read_only_reason?: string | null
          stem_html?: string
          type_specific?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          canvas_quiz_id: string
          created_at: string
          description_html: string
          engine: string
          id: string
          links: Json
          module_item_id: string
          points_possible: number | null
          question_count: number
          raw_payload: Json
          read_only_reason: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canvas_quiz_id: string
          created_at?: string
          description_html?: string
          engine: string
          id?: string
          links?: Json
          module_item_id: string
          points_possible?: number | null
          question_count: number
          raw_payload?: Json
          read_only_reason?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canvas_quiz_id?: string
          created_at?: string
          description_html?: string
          engine?: string
          id?: string
          links?: Json
          module_item_id?: string
          points_possible?: number | null
          question_count?: number
          raw_payload?: Json
          read_only_reason?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_module_item_id_fkey"
            columns: ["module_item_id"]
            isOneToOne: true
            referencedRelation: "module_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_change_proposals: {
        Args: { p_proposal_ids: string[] }
        Returns: {
          accepted: boolean
          proposal_id: string
          reason: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
