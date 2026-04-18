export type HoleStatus = "empty" | "planted" | "growing" | "ready_harvest" | "harvested" | "maintenance";
export type UserRole = "admin" | "operator" | "viewer";
export type CycleStatus = "planted" | "growing" | "ready_harvest" | "harvested" | "cancelled";
export type BatchStatus = "active" | "completed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          role?: UserRole;
        };
        Relationships: [];
      };
      crop_catalog: {
        Row: {
          id: number;
          name_id: string;
          name_latin: string | null;
          grow_duration_days: number;
          ec_min: number | null;
          ec_max: number | null;
          ph_min: number | null;
          ph_max: number | null;
          co2_min: number | null;
          co2_max: number | null;
          vpd_min: number | null;
          vpd_max: number | null;
          ppfd_min: number | null;
          ppfd_max: number | null;
          solution_temp_min: number | null;
          solution_temp_max: number | null;
          density_notes: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          name_id: string;
          name_latin?: string | null;
          grow_duration_days?: number;
          ec_min?: number | null;
          ec_max?: number | null;
          ph_min?: number | null;
          ph_max?: number | null;
          co2_min?: number | null;
          co2_max?: number | null;
          vpd_min?: number | null;
          vpd_max?: number | null;
          ppfd_min?: number | null;
          ppfd_max?: number | null;
          solution_temp_min?: number | null;
          solution_temp_max?: number | null;
          density_notes?: string | null;
          photo_url?: string | null;
        };
        Update: {
          name_id?: string;
          name_latin?: string | null;
          grow_duration_days?: number;
          ec_min?: number | null;
          ec_max?: number | null;
          ph_min?: number | null;
          ph_max?: number | null;
          co2_min?: number | null;
          co2_max?: number | null;
          vpd_min?: number | null;
          vpd_max?: number | null;
          ppfd_min?: number | null;
          ppfd_max?: number | null;
          solution_temp_min?: number | null;
          solution_temp_max?: number | null;
          density_notes?: string | null;
          photo_url?: string | null;
        };
        Relationships: [];
      };
      holes: {
        Row: {
          id: number;
          rack: string;
          tier: number;
          lane: number;
          hole_number: number;
          canonical_id: string;
          status: HoleStatus;
          current_cycle_id: number | null;
          updated_at: string;
        };
        Insert: {
          rack: string;
          tier: number;
          lane: number;
          hole_number: number;
          status?: HoleStatus;
        };
        Update: {
          status?: HoleStatus;
          current_cycle_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_holes_current_cycle";
            columns: ["current_cycle_id"];
            isOneToOne: false;
            referencedRelation: "planting_cycles";
            referencedColumns: ["id"];
          }
        ];
      };
      batches: {
        Row: {
          id: number;
          batch_code: string;
          crop_catalog_id: number;
          planted_at: string;
          notes: string | null;
          created_by: string | null;
          status: BatchStatus;
          created_at: string;
        };
        Insert: {
          batch_code?: string;
          crop_catalog_id: number;
          planted_at?: string;
          notes?: string | null;
          created_by?: string | null;
          status?: BatchStatus;
        };
        Update: {
          batch_code?: string;
          notes?: string | null;
          status?: BatchStatus;
        };
        Relationships: [
          {
            foreignKeyName: "batches_crop_catalog_id_fkey";
            columns: ["crop_catalog_id"];
            isOneToOne: false;
            referencedRelation: "crop_catalog";
            referencedColumns: ["id"];
          }
        ];
      };
      planting_cycles: {
        Row: {
          id: number;
          hole_id: number;
          batch_id: number;
          crop_catalog_id: number;
          planted_at: string;
          expected_harvest_at: string | null;
          harvested_at: string | null;
          harvest_weight_g: number | null;
          quality_grade: string | null;
          status: CycleStatus;
          notes: string | null;
          created_by: string | null;
          updated_at: string;
          visual_condition: string | null;
          post_harvest_handling: string | null;
          harvest_notes: string | null;
          early_harvest_reason: string | null;
        };
        Insert: {
          hole_id: number;
          batch_id: number;
          crop_catalog_id: number;
          planted_at?: string;
          expected_harvest_at?: string | null;
          status?: CycleStatus;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: CycleStatus;
          harvested_at?: string | null;
          harvest_weight_g?: number | null;
          quality_grade?: string | null;
          notes?: string | null;
          visual_condition?: string | null;
          post_harvest_handling?: string | null;
          harvest_notes?: string | null;
          early_harvest_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "planting_cycles_hole_id_fkey";
            columns: ["hole_id"];
            isOneToOne: false;
            referencedRelation: "holes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planting_cycles_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planting_cycles_crop_catalog_id_fkey";
            columns: ["crop_catalog_id"];
            isOneToOne: false;
            referencedRelation: "crop_catalog";
            referencedColumns: ["id"];
          }
        ];
      };
      environmental_logs: {
        Row: {
          id: number;
          rack: string | null;
          tier: number | null;
          temperature_c: number | null;
          humidity_pct: number | null;
          ec_ms: number | null;
          ph: number | null;
          water_temp_c: number | null;
          co2_ppm: number | null;
          vpd_kpa: number | null;
          ppfd_umol: number | null;
          growlight_on: boolean | null;
          ac_on: boolean | null;
          fan_on: boolean | null;
          notes: string | null;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          rack?: string | null;
          tier?: number | null;
          temperature_c?: number | null;
          humidity_pct?: number | null;
          ec_ms?: number | null;
          ph?: number | null;
          water_temp_c?: number | null;
          co2_ppm?: number | null;
          vpd_kpa?: number | null;
          ppfd_umol?: number | null;
          growlight_on?: boolean | null;
          ac_on?: boolean | null;
          fan_on?: boolean | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Update: {
          rack?: string | null;
          tier?: number | null;
          temperature_c?: number | null;
          humidity_pct?: number | null;
          ec_ms?: number | null;
          ph?: number | null;
          water_temp_c?: number | null;
          co2_ppm?: number | null;
          vpd_kpa?: number | null;
          ppfd_umol?: number | null;
          growlight_on?: boolean | null;
          ac_on?: boolean | null;
          fan_on?: boolean | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Relationships: [];
      };
      nutrient_logs: {
        Row: {
          id: number;
          mixed_at: string;
          volume_liters: number | null;
          formula_name: string | null;
          ec_target: number | null;
          ph_target: number | null;
          ec_actual: number | null;
          ph_actual: number | null;
          mixed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          volume_liters?: number | null;
          formula_name?: string | null;
          ec_target?: number | null;
          ph_target?: number | null;
          ec_actual?: number | null;
          ph_actual?: number | null;
          mixed_by?: string | null;
          notes?: string | null;
        };
        Update: {
          volume_liters?: number | null;
          formula_name?: string | null;
          ec_target?: number | null;
          ph_target?: number | null;
          ec_actual?: number | null;
          ph_actual?: number | null;
          mixed_by?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      employee_details: {
        Row: {
          id: number;
          user_id: string;
          nik: string | null;
          position: string | null;
          department: string | null;
          join_date: string | null;
          contract_type: string | null;
          base_salary: number;
          phone: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nik?: string | null;
          position?: string | null;
          department?: string | null;
          join_date?: string | null;
          contract_type?: string | null;
          base_salary?: number;
          phone?: string | null;
          address?: string | null;
        };
        Update: {
          user_id?: string;
          nik?: string | null;
          position?: string | null;
          department?: string | null;
          join_date?: string | null;
          contract_type?: string | null;
          base_salary?: number;
          phone?: string | null;
          address?: string | null;
        };
        Relationships: [];
      };
      attendance_logs: {
        Row: {
          id: number;
          user_id: string;
          date: string;
          clock_in: string | null;
          clock_out: string | null;
          total_hours: number;
          overtime_hours: number;
          status: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          date?: string;
          clock_in?: string | null;
          clock_out?: string | null;
          total_hours?: number;
          overtime_hours?: number;
          status?: string;
          notes?: string | null;
        };
        Update: {
          clock_in?: string | null;
          clock_out?: string | null;
          total_hours?: number;
          overtime_hours?: number;
          status?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      payroll_records: {
        Row: {
          id: number;
          user_id: string;
          period_month: number;
          period_year: number;
          base_salary: number;
          overtime_pay: number;
          allowances: number;
          deductions: number;
          total: number;
          status: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          period_month: number;
          period_year: number;
          base_salary?: number;
          overtime_pay?: number;
          allowances?: number;
          deductions?: number;
          total?: number;
          status?: string;
          notes?: string | null;
        };
        Update: {
          base_salary?: number;
          overtime_pay?: number;
          allowances?: number;
          deductions?: number;
          total?: number;
          status?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: number;
          name: string;
          type: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          type?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          type?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      sales_orders: {
        Row: {
          id: number;
          customer_id: number;
          order_date: string;
          status: string;
          total_amount: number;
          discount_amount: number;
          tax_percent: number;
          tax_amount: number;
          grand_total: number;
          payment_method: string | null;
          payment_status: string;
          due_date: string | null;
          invoice_number: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id: number;
          order_date?: string;
          status?: string;
          total_amount?: number;
          discount_amount?: number;
          tax_percent?: number;
          tax_amount?: number;
          grand_total?: number;
          payment_method?: string | null;
          payment_status?: string;
          due_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: string;
          total_amount?: number;
          discount_amount?: number;
          tax_percent?: number;
          tax_amount?: number;
          grand_total?: number;
          payment_method?: string | null;
          payment_status?: string;
          due_date?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      sales_order_items: {
        Row: {
          id: number;
          order_id: number;
          crop_catalog_id: number;
          quantity_kg: number;
          unit_price: number;
          subtotal: number;
          quality_grade: string | null;
          discount_percent: number;
          discount_amount: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          order_id: number;
          crop_catalog_id: number;
          quantity_kg: number;
          unit_price: number;
          subtotal: number;
          quality_grade?: string | null;
          discount_percent?: number;
          discount_amount?: number;
          notes?: string | null;
        };
        Update: {
          quantity_kg?: number;
          unit_price?: number;
          subtotal?: number;
          quality_grade?: string | null;
          discount_percent?: number;
          discount_amount?: number;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_crop_catalog_id_fkey";
            columns: ["crop_catalog_id"];
            isOneToOne: false;
            referencedRelation: "crop_catalog";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_logs: {
        Row: {
          id: number;
          order_id: number;
          payment_date: string;
          amount: number;
          method: string | null;
          reference: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          order_id: number;
          amount: number;
          payment_date?: string;
          method?: string | null;
          reference?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          amount?: number;
          method?: string | null;
          reference?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_logs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          }
        ];
      };
      price_history: {
        Row: {
          id: number;
          crop_catalog_id: number;
          quality_grade: string | null;
          price_per_kg: number;
          effective_date: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          crop_catalog_id: number;
          price_per_kg: number;
          quality_grade?: string | null;
          effective_date?: string;
          created_by?: string | null;
        };
        Update: {
          price_per_kg?: number;
          quality_grade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_crop_catalog_id_fkey";
            columns: ["crop_catalog_id"];
            isOneToOne: false;
            referencedRelation: "crop_catalog";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      hole_status: HoleStatus;
      user_role: UserRole;
      cycle_status: CycleStatus;
      batch_status: BatchStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience types
export type Hole = Database["public"]["Tables"]["holes"]["Row"];
export type CropCatalog = Database["public"]["Tables"]["crop_catalog"]["Row"];
export type Batch = Database["public"]["Tables"]["batches"]["Row"];
export type PlantingCycle = Database["public"]["Tables"]["planting_cycles"]["Row"];
export type EnvironmentalLog = Database["public"]["Tables"]["environmental_logs"]["Row"];
export type NutrientLog = Database["public"]["Tables"]["nutrient_logs"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type EmployeeDetail = Database["public"]["Tables"]["employee_details"]["Row"];
export type AttendanceLog = Database["public"]["Tables"]["attendance_logs"]["Row"];
export type PayrollRecord = Database["public"]["Tables"]["payroll_records"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type SalesOrder = Database["public"]["Tables"]["sales_orders"]["Row"];
export type SalesOrderItem = Database["public"]["Tables"]["sales_order_items"]["Row"];
export type PaymentLog = Database["public"]["Tables"]["payment_logs"]["Row"];
export type PriceHistory = Database["public"]["Tables"]["price_history"]["Row"];
