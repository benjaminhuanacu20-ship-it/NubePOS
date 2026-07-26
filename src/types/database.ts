export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      profiles: {
        Row: { id: string; company_id: string; full_name: string; role: string; created_at: string }
        Insert: { id: string; company_id: string; full_name: string; role?: string; created_at?: string }
        Update: { id?: string; company_id?: string; full_name?: string; role?: string; created_at?: string }
        Relationships: Relationship[]
      }
      products: {
        Row: { id: string; company_id: string; name: string; sku: string | null; price: number; active: boolean; created_at: string }
        Insert: { id?: string; company_id: string; name: string; sku?: string | null; price: number; active?: boolean; created_at?: string }
        Update: { id?: string; company_id?: string; name?: string; sku?: string | null; price?: number; active?: boolean; created_at?: string }
        Relationships: [
          { foreignKeyName: 'inventory_product_id_fkey'; columns: ['id']; isOneToOne: true; referencedRelation: 'inventory'; referencedColumns: ['product_id'] },
        ]
      }
      inventory: {
        Row: { id: string; product_id: string; quantity: number; min_stock: number; updated_at: string }
        Insert: { id?: string; product_id: string; quantity?: number; min_stock?: number; updated_at?: string }
        Update: { id?: string; product_id?: string; quantity?: number; min_stock?: number; updated_at?: string }
        Relationships: [
          { foreignKeyName: 'inventory_product_id_fkey'; columns: ['product_id']; isOneToOne: true; referencedRelation: 'products'; referencedColumns: ['id'] },
        ]
      }
      customers: {
        Row: { id: string; company_id: string; name: string; email: string | null; phone: string | null; last_purchase_at: string | null; created_at: string }
        Insert: { id?: string; company_id: string; name: string; email?: string | null; phone?: string | null; last_purchase_at?: string | null; created_at?: string }
        Update: { id?: string; company_id?: string; name?: string; email?: string | null; phone?: string | null; last_purchase_at?: string | null; created_at?: string }
        Relationships: Relationship[]
      }
      sales: {
        Row: { id: string; company_id: string; customer_id: string | null; total: number; created_at: string }
        Insert: { id?: string; company_id: string; customer_id?: string | null; total: number; created_at?: string }
        Update: { id?: string; company_id?: string; customer_id?: string | null; total?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: 'sales_customer_id_fkey'; columns: ['customer_id']; isOneToOne: false; referencedRelation: 'customers'; referencedColumns: ['id'] },
        ]
      }
      sale_items: {
        Row: { id: string; sale_id: string; product_id: string; quantity: number; unit_price: number }
        Insert: { id?: string; sale_id: string; product_id: string; quantity: number; unit_price: number }
        Update: { id?: string; sale_id?: string; product_id?: string; quantity?: number; unit_price?: number }
        Relationships: [
          { foreignKeyName: 'sale_items_sale_id_fkey'; columns: ['sale_id']; isOneToOne: false; referencedRelation: 'sales'; referencedColumns: ['id'] },
          { foreignKeyName: 'sale_items_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] },
        ]
      }
      alerts: {
        Row: { id: string; company_id: string; type: string; title: string; message: string; status: string; created_at: string }
        Insert: { id?: string; company_id: string; type: string; title: string; message: string; status?: string; created_at?: string }
        Update: { id?: string; company_id?: string; type?: string; title?: string; message?: string; status?: string; created_at?: string }
        Relationships: Relationship[]
      }
      recommendations: {
        Row: { id: string; company_id: string; type: string; title: string; message: string; action_type: string; status: string; metadata: Json; created_at: string }
        Insert: { id?: string; company_id: string; type: string; title: string; message: string; action_type: string; status?: string; metadata?: Json; created_at?: string }
        Update: { id?: string; company_id?: string; type?: string; title?: string; message?: string; action_type?: string; status?: string; metadata?: Json; created_at?: string }
        Relationships: Relationship[]
      }
      promotions: {
        Row: { id: string; company_id: string; product_id: string | null; discount_pct: number; description: string; status: string; created_at: string }
        Insert: { id?: string; company_id: string; product_id?: string | null; discount_pct: number; description: string; status?: string; created_at?: string }
        Update: { id?: string; company_id?: string; product_id?: string | null; discount_pct?: number; description?: string; status?: string; created_at?: string }
        Relationships: [
          { foreignKeyName: 'promotions_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      setup_new_user: {
        Args: { p_company_name: string; p_full_name: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
