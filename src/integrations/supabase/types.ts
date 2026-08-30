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
      admissions: {
        Row: {
          admitted_at: string
          bed_id: string
          care_type: Database["public"]["Enums"]["care_type"]
          created_at: string
          diet_note: string | null
          discharged_at: string | null
          id: string
          main_diagnosis: string | null
          notes: string | null
          patient_id: string
          status: Database["public"]["Enums"]["admission_status"]
        }
        Insert: {
          admitted_at?: string
          bed_id: string
          care_type: Database["public"]["Enums"]["care_type"]
          created_at?: string
          diet_note?: string | null
          discharged_at?: string | null
          id?: string
          main_diagnosis?: string | null
          notes?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["admission_status"]
        }
        Update: {
          admitted_at?: string
          bed_id?: string
          care_type?: Database["public"]["Enums"]["care_type"]
          created_at?: string
          diet_note?: string | null
          discharged_at?: string | null
          id?: string
          main_diagnosis?: string | null
          notes?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["admission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "admissions_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      anthropometric_estimates: {
        Row: {
          created_at: string
          formula: string
          id: string
          method: string
          parameters: Json
          patient_id: string
          professional_id: string | null
          professional_name: string
          protocol: string | null
          result: number | null
          screening_id: string | null
          target: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          formula: string
          id?: string
          method: string
          parameters?: Json
          patient_id: string
          professional_id?: string | null
          professional_name?: string
          protocol?: string | null
          result?: number | null
          screening_id?: string | null
          target: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          formula?: string
          id?: string
          method?: string
          parameters?: Json
          patient_id?: string
          professional_id?: string | null
          professional_name?: string
          protocol?: string | null
          result?: number | null
          screening_id?: string | null
          target?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anthropometric_estimates_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anthropometric_estimates_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          room_id: string | null
          ward_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          room_id?: string | null
          ward_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          room_id?: string | null
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string
          id: string
          medical_record: string | null
          mother_name: string | null
          notes: string | null
          race: Database["public"]["Enums"]["race_type"]
          sex: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name: string
          id?: string
          medical_record?: string | null
          mother_name?: string | null
          notes?: string | null
          race?: Database["public"]["Enums"]["race_type"]
          sex?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id?: string
          medical_record?: string | null
          mother_name?: string | null
          notes?: string | null
          race?: Database["public"]["Enums"]["race_type"]
          sex?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          ward_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          ward_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      screenings: {
        Row: {
          admission_id: string
          appetite: string | null
          arm_circumference_cm: number | null
          bmi: number | null
          calf_circumference_cm: number | null
          chewing: string | null
          clinical_notes: string | null
          conditions: Json
          created_at: string
          diet_type: string | null
          feeding_notes: string | null
          feeding_route: string | null
          height_cm: number | null
          height_method: string | null
          height_source: Database["public"]["Enums"]["measure_source"] | null
          id: string
          intake_acceptance: string | null
          is_reassessment: boolean
          knee_height_cm: number | null
          nan_level: string | null
          next_screening_at: string | null
          patient_id: string
          professional_id: string | null
          professional_name: string
          screened_at: string
          subscapular_skinfold_mm: number | null
          swallowing: string | null
          usual_weight_kg: number | null
          weight_kg: number | null
          weight_loss_percentage: number | null
          weight_loss_period_months: number | null
          weight_method: string | null
          weight_source: Database["public"]["Enums"]["measure_source"] | null
        }
        Insert: {
          admission_id: string
          appetite?: string | null
          arm_circumference_cm?: number | null
          bmi?: number | null
          calf_circumference_cm?: number | null
          chewing?: string | null
          clinical_notes?: string | null
          conditions?: Json
          created_at?: string
          diet_type?: string | null
          feeding_notes?: string | null
          feeding_route?: string | null
          height_cm?: number | null
          height_method?: string | null
          height_source?: Database["public"]["Enums"]["measure_source"] | null
          id?: string
          intake_acceptance?: string | null
          is_reassessment?: boolean
          knee_height_cm?: number | null
          nan_level?: string | null
          next_screening_at?: string | null
          patient_id: string
          professional_id?: string | null
          professional_name?: string
          screened_at?: string
          subscapular_skinfold_mm?: number | null
          swallowing?: string | null
          usual_weight_kg?: number | null
          weight_kg?: number | null
          weight_loss_percentage?: number | null
          weight_loss_period_months?: number | null
          weight_method?: string | null
          weight_source?: Database["public"]["Enums"]["measure_source"] | null
        }
        Update: {
          admission_id?: string
          appetite?: string | null
          arm_circumference_cm?: number | null
          bmi?: number | null
          calf_circumference_cm?: number | null
          chewing?: string | null
          clinical_notes?: string | null
          conditions?: Json
          created_at?: string
          diet_type?: string | null
          feeding_notes?: string | null
          feeding_route?: string | null
          height_cm?: number | null
          height_method?: string | null
          height_source?: Database["public"]["Enums"]["measure_source"] | null
          id?: string
          intake_acceptance?: string | null
          is_reassessment?: boolean
          knee_height_cm?: number | null
          nan_level?: string | null
          next_screening_at?: string | null
          patient_id?: string
          professional_id?: string | null
          professional_name?: string
          screened_at?: string
          subscapular_skinfold_mm?: number | null
          swallowing?: string | null
          usual_weight_kg?: number | null
          weight_kg?: number | null
          weight_loss_percentage?: number | null
          weight_loss_period_months?: number | null
          weight_method?: string | null
          weight_source?: Database["public"]["Enums"]["measure_source"] | null
        }
        Relationships: [
          {
            foreignKeyName: "screenings_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screenings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wards: {
        Row: {
          care_type: Database["public"]["Enums"]["care_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          care_type: Database["public"]["Enums"]["care_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          care_type?: Database["public"]["Enums"]["care_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      admission_status: "ativa" | "alta"
      app_role: "admin" | "nutricionista" | "visualizador"
      care_type: "particular" | "sus" | "uti"
      measure_source: "aferido" | "estimado" | "relatado"
      race_type:
        | "branca"
        | "preta"
        | "parda"
        | "amarela"
        | "indigena"
        | "nao_informado"
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
    Enums: {
      admission_status: ["ativa", "alta"],
      app_role: ["admin", "nutricionista", "visualizador"],
      care_type: ["particular", "sus", "uti"],
      measure_source: ["aferido", "estimado", "relatado"],
      race_type: [
        "branca",
        "preta",
        "parda",
        "amarela",
        "indigena",
        "nao_informado",
      ],
    },
  },
} as const
