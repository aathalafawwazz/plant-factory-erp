export type HoleStatus = "empty" | "planted" | "growing" | "ready_harvest" | "harvested" | "maintenance";
export type UserRole = "admin" | "operator" | "viewer" | "researcher";
export type ResearchType = "skripsi" | "tesis" | "disertasi" | "dosen" | "eksternal" | "internal";
export type ResearchStatus = "proposed" | "approved" | "active" | "paused" | "completed" | "cancelled";
export type ResearchAttachmentKind = "photo" | "document" | "dataset" | "report";
export type VisitType = "tour" | "meeting" | "field_trip" | "media" | "partnership" | "training" | "government" | "other";
export type VisitStatus = "scheduled" | "confirmed" | "ongoing" | "completed" | "cancelled" | "no_show";
export type VisitAttachmentKind = "photo" | "document" | "signature";
export type CycleStatus = "planted" | "growing" | "ready_harvest" | "harvested" | "cancelled";
export type BatchStatus = "active" | "completed";

export type InventoryCategory = "seed" | "nutrient" | "media" | "ph_solution" | "packaging" | "equipment" | "product" | "other";
export type InventoryTxnType = "in" | "out" | "adjustment";
export type InventoryTxnSource = "purchase" | "harvest" | "sale" | "usage" | "waste" | "manual";
export type ExpenseCategory = "seed" | "nutrient" | "media" | "ph_solution" | "packaging" | "utility" | "labor" | "equipment" | "maintenance" | "other";
export type ExpensePaymentMethod = "tunai" | "transfer" | "ewallet" | "kartu" | "lainnya";

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
          research_id: number | null;
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
          research_id?: number | null;
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
      planting_photos: {
        Row: {
          id: number;
          cycle_id: number;
          storage_path: string;
          kind: "planting" | "maintenance" | "harvest";
          captured_at: string;
          captured_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          cycle_id: number;
          storage_path: string;
          kind?: "planting" | "maintenance" | "harvest";
          captured_at?: string;
          captured_by?: string | null;
          notes?: string | null;
        };
        Update: {
          notes?: string | null;
          kind?: "planting" | "maintenance" | "harvest";
        };
        Relationships: [
          {
            foreignKeyName: "planting_photos_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "planting_cycles";
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
      inventory_items: {
        Row: {
          id: number;
          name: string;
          category: InventoryCategory;
          sku: string | null;
          unit: string;
          current_stock: number;
          min_stock: number | null;
          unit_cost: number | null;
          unit_price: number | null;
          supplier: string | null;
          notes: string | null;
          crop_catalog_id: number | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          category: InventoryCategory;
          sku?: string | null;
          unit?: string;
          current_stock?: number;
          min_stock?: number | null;
          unit_cost?: number | null;
          unit_price?: number | null;
          supplier?: string | null;
          notes?: string | null;
          crop_catalog_id?: number | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          category?: InventoryCategory;
          sku?: string | null;
          unit?: string;
          current_stock?: number;
          min_stock?: number | null;
          unit_cost?: number | null;
          unit_price?: number | null;
          supplier?: string | null;
          notes?: string | null;
          crop_catalog_id?: number | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          id: number;
          item_id: number;
          txn_type: InventoryTxnType;
          source: InventoryTxnSource;
          quantity: number;
          unit_cost: number | null;
          total_cost: number | null;
          reference_type: string | null;
          reference_id: number | null;
          notes: string | null;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          item_id: number;
          txn_type: InventoryTxnType;
          source?: InventoryTxnSource;
          quantity: number;
          unit_cost?: number | null;
          total_cost?: number | null;
          reference_type?: string | null;
          reference_id?: number | null;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Update: {
          txn_type?: InventoryTxnType;
          source?: InventoryTxnSource;
          quantity?: number;
          unit_cost?: number | null;
          total_cost?: number | null;
          reference_type?: string | null;
          reference_id?: number | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          }
        ];
      };
      expenses: {
        Row: {
          id: number;
          expense_date: string;
          category: ExpenseCategory;
          amount: number;
          description: string;
          vendor: string | null;
          payment_method: ExpensePaymentMethod | null;
          inventory_item_id: number | null;
          quantity: number | null;
          receipt_url: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          expense_date?: string;
          category: ExpenseCategory;
          amount: number;
          description: string;
          vendor?: string | null;
          payment_method?: ExpensePaymentMethod | null;
          inventory_item_id?: number | null;
          quantity?: number | null;
          receipt_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          expense_date?: string;
          category?: ExpenseCategory;
          amount?: number;
          description?: string;
          vendor?: string | null;
          payment_method?: ExpensePaymentMethod | null;
          inventory_item_id?: number | null;
          quantity?: number | null;
          receipt_url?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          }
        ];
      };
      research_projects: {
        Row: {
          id: number;
          code: string;
          title: string;
          description: string | null;
          research_type: ResearchType;
          objective: string | null;
          researcher_user_id: string | null;
          researcher_name: string;
          researcher_id_no: string | null;
          institution: string | null;
          email: string | null;
          phone: string | null;
          supervisor_name: string | null;
          supervisor_email: string | null;
          proposed_start: string | null;
          proposed_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          status: ResearchStatus;
          approved_by: string | null;
          approved_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code?: string;
          title: string;
          description?: string | null;
          research_type?: ResearchType;
          objective?: string | null;
          researcher_user_id?: string | null;
          researcher_name: string;
          researcher_id_no?: string | null;
          institution?: string | null;
          email?: string | null;
          phone?: string | null;
          supervisor_name?: string | null;
          supervisor_email?: string | null;
          proposed_start?: string | null;
          proposed_end?: string | null;
          actual_start?: string | null;
          actual_end?: string | null;
          status?: ResearchStatus;
          approved_by?: string | null;
          approved_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["research_projects"]["Insert"]>;
        Relationships: [];
      };
      research_hole_allocations: {
        Row: {
          id: number;
          research_id: number;
          hole_id: number;
          treatment_label: string | null;
          treatment_group: string | null;
          reserved_from: string;
          reserved_until: string;
          released_at: string | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          research_id: number;
          hole_id: number;
          treatment_label?: string | null;
          treatment_group?: string | null;
          reserved_from: string;
          reserved_until: string;
          released_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["research_hole_allocations"]["Insert"]>;
        Relationships: [];
      };
      research_progress_logs: {
        Row: {
          id: number;
          research_id: number;
          phase: string | null;
          log_date: string;
          summary: string;
          metrics: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          research_id: number;
          phase?: string | null;
          log_date?: string;
          summary: string;
          metrics?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["research_progress_logs"]["Insert"]>;
        Relationships: [];
      };
      research_attachments: {
        Row: {
          id: number;
          research_id: number;
          progress_log_id: number | null;
          kind: ResearchAttachmentKind;
          storage_path: string;
          filename: string | null;
          notes: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          research_id: number;
          progress_log_id?: number | null;
          kind?: ResearchAttachmentKind;
          storage_path: string;
          filename?: string | null;
          notes?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["research_attachments"]["Insert"]>;
        Relationships: [];
      };
      visits: {
        Row: {
          id: number;
          code: string;
          visit_type: VisitType;
          purpose: string;
          visit_date: string;
          start_time: string | null;
          end_time: string | null;
          checked_in_at: string | null;
          checked_out_at: string | null;
          organization: string;
          group_size: number;
          host_user_id: string | null;
          host_name: string | null;
          areas_visited: string[] | null;
          status: VisitStatus;
          feedback_rating: number | null;
          feedback_notes: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code?: string;
          visit_type?: VisitType;
          purpose: string;
          visit_date: string;
          start_time?: string | null;
          end_time?: string | null;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          organization: string;
          group_size?: number;
          host_user_id?: string | null;
          host_name?: string | null;
          areas_visited?: string[] | null;
          status?: VisitStatus;
          feedback_rating?: number | null;
          feedback_notes?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
        Relationships: [];
      };
      visit_contacts: {
        Row: {
          id: number;
          visit_id: number;
          name: string;
          role: string | null;
          email: string | null;
          phone: string | null;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          visit_id: number;
          name: string;
          role?: string | null;
          email?: string | null;
          phone?: string | null;
          is_primary?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["visit_contacts"]["Insert"]>;
        Relationships: [];
      };
      visit_attachments: {
        Row: {
          id: number;
          visit_id: number;
          kind: VisitAttachmentKind;
          storage_path: string;
          filename: string | null;
          notes: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          visit_id: number;
          kind?: VisitAttachmentKind;
          storage_path: string;
          filename?: string | null;
          notes?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["visit_attachments"]["Insert"]>;
        Relationships: [];
      };
      research_materials: {
        Row: {
          id: number;
          research_id: number;
          item_name: string;
          qty: number | null;
          unit: string | null;
          expense_id: number | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          research_id: number;
          item_name: string;
          qty?: number | null;
          unit?: string | null;
          expense_id?: number | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["research_materials"]["Insert"]>;
        Relationships: [];
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
export type ResearchProject = Database["public"]["Tables"]["research_projects"]["Row"];
export type ResearchHoleAllocation = Database["public"]["Tables"]["research_hole_allocations"]["Row"];
export type ResearchProgressLog = Database["public"]["Tables"]["research_progress_logs"]["Row"];
export type ResearchAttachment = Database["public"]["Tables"]["research_attachments"]["Row"];
export type ResearchMaterial = Database["public"]["Tables"]["research_materials"]["Row"];
export type Visit = Database["public"]["Tables"]["visits"]["Row"];
export type VisitContact = Database["public"]["Tables"]["visit_contacts"]["Row"];
export type VisitAttachment = Database["public"]["Tables"]["visit_attachments"]["Row"];

// ============================================================
// Inventory & Expenses
// ============================================================

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  sku: string | null;
  unit: string;
  current_stock: number;
  min_stock: number | null;
  unit_cost: number | null;
  unit_price: number | null;
  supplier: string | null;
  notes: string | null;
  crop_catalog_id: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: number;
  item_id: number;
  txn_type: InventoryTxnType;
  source: InventoryTxnSource;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface Expense {
  id: number;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  vendor: string | null;
  payment_method: ExpensePaymentMethod | null;
  inventory_item_id: number | null;
  quantity: number | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
