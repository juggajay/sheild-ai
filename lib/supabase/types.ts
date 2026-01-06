export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'risk_manager' | 'project_manager' | 'project_administrator' | 'read_only'
export type PortalRole = 'subcontractor' | 'broker'
export type ProjectStatus = 'active' | 'completed' | 'on_hold'
export type ComplianceStatus = 'pending' | 'compliant' | 'non_compliant' | 'exception'
export type VerificationStatus = 'pass' | 'fail' | 'review'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ExceptionStatus = 'pending_approval' | 'active' | 'expired' | 'resolved' | 'closed'
export type CommunicationType = 'deficiency' | 'follow_up' | 'confirmation' | 'expiration_reminder' | 'critical_alert'
export type CoverageType = 'public_liability' | 'products_liability' | 'workers_comp' | 'professional_indemnity' | 'motor_vehicle' | 'contract_works'
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT' | 'ACT'

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          abn: string
          acn: string | null
          logo_url: string | null
          address: string | null
          primary_contact_name: string | null
          primary_contact_email: string | null
          primary_contact_phone: string | null
          forwarding_email: string | null
          settings: Json | null
          subscription_tier: string | null
          subscription_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          abn: string
          acn?: string | null
          logo_url?: string | null
          address?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          primary_contact_phone?: string | null
          forwarding_email?: string | null
          settings?: Json | null
          subscription_tier?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          abn?: string
          acn?: string | null
          logo_url?: string | null
          address?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          primary_contact_phone?: string | null
          forwarding_email?: string | null
          settings?: Json | null
          subscription_tier?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          company_id: string
          email: string
          name: string
          phone: string | null
          role: UserRole
          avatar_url: string | null
          notification_preferences: Json | null
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id: string
          email: string
          name: string
          phone?: string | null
          role?: UserRole
          avatar_url?: string | null
          notification_preferences?: Json | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          email?: string
          name?: string
          phone?: string | null
          role?: UserRole
          avatar_url?: string | null
          notification_preferences?: Json | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          company_id: string
          name: string
          address: string | null
          state: AustralianState | null
          start_date: string | null
          end_date: string | null
          estimated_value: number | null
          project_manager_id: string | null
          forwarding_email: string | null
          status: ProjectStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          address?: string | null
          state?: AustralianState | null
          start_date?: string | null
          end_date?: string | null
          estimated_value?: number | null
          project_manager_id?: string | null
          forwarding_email?: string | null
          status?: ProjectStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          address?: string | null
          state?: AustralianState | null
          start_date?: string | null
          end_date?: string | null
          estimated_value?: number | null
          project_manager_id?: string | null
          forwarding_email?: string | null
          status?: ProjectStatus
          created_at?: string
          updated_at?: string
        }
      }
      insurance_requirements: {
        Row: {
          id: string
          project_id: string
          coverage_type: CoverageType
          minimum_limit: number | null
          limit_type: 'per_occurrence' | 'aggregate' | null
          maximum_excess: number | null
          principal_indemnity_required: boolean
          cross_liability_required: boolean
          other_requirements: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          coverage_type: CoverageType
          minimum_limit?: number | null
          limit_type?: 'per_occurrence' | 'aggregate' | null
          maximum_excess?: number | null
          principal_indemnity_required?: boolean
          cross_liability_required?: boolean
          other_requirements?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          coverage_type?: CoverageType
          minimum_limit?: number | null
          limit_type?: 'per_occurrence' | 'aggregate' | null
          maximum_excess?: number | null
          principal_indemnity_required?: boolean
          cross_liability_required?: boolean
          other_requirements?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subcontractors: {
        Row: {
          id: string
          company_id: string
          name: string
          abn: string
          acn: string | null
          trading_name: string | null
          address: string | null
          trade: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          broker_name: string | null
          broker_email: string | null
          broker_phone: string | null
          workers_comp_state: AustralianState | null
          portal_access: boolean
          portal_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          abn: string
          acn?: string | null
          trading_name?: string | null
          address?: string | null
          trade?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          broker_name?: string | null
          broker_email?: string | null
          broker_phone?: string | null
          workers_comp_state?: AustralianState | null
          portal_access?: boolean
          portal_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          abn?: string
          acn?: string | null
          trading_name?: string | null
          address?: string | null
          trade?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          broker_name?: string | null
          broker_email?: string | null
          broker_phone?: string | null
          workers_comp_state?: AustralianState | null
          portal_access?: boolean
          portal_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_subcontractors: {
        Row: {
          id: string
          project_id: string
          subcontractor_id: string
          status: ComplianceStatus
          on_site_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          subcontractor_id: string
          status?: ComplianceStatus
          on_site_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          subcontractor_id?: string
          status?: ComplianceStatus
          on_site_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      coc_documents: {
        Row: {
          id: string
          subcontractor_id: string
          project_id: string
          file_url: string
          file_name: string | null
          file_size: number | null
          source: 'email' | 'upload' | 'portal' | 'api'
          source_email: string | null
          received_at: string | null
          processed_at: string | null
          processing_status: ProcessingStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subcontractor_id: string
          project_id: string
          file_url: string
          file_name?: string | null
          file_size?: number | null
          source?: 'email' | 'upload' | 'portal' | 'api'
          source_email?: string | null
          received_at?: string | null
          processed_at?: string | null
          processing_status?: ProcessingStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subcontractor_id?: string
          project_id?: string
          file_url?: string
          file_name?: string | null
          file_size?: number | null
          source?: 'email' | 'upload' | 'portal' | 'api'
          source_email?: string | null
          received_at?: string | null
          processed_at?: string | null
          processing_status?: ProcessingStatus
          created_at?: string
          updated_at?: string
        }
      }
      verifications: {
        Row: {
          id: string
          coc_document_id: string
          project_id: string
          status: VerificationStatus
          confidence_score: number | null
          extracted_data: Json | null
          checks: Json | null
          deficiencies: Json | null
          verified_by_user_id: string | null
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          coc_document_id: string
          project_id: string
          status?: VerificationStatus
          confidence_score?: number | null
          extracted_data?: Json | null
          checks?: Json | null
          deficiencies?: Json | null
          verified_by_user_id?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          coc_document_id?: string
          project_id?: string
          status?: VerificationStatus
          confidence_score?: number | null
          extracted_data?: Json | null
          checks?: Json | null
          deficiencies?: Json | null
          verified_by_user_id?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      communications: {
        Row: {
          id: string
          subcontractor_id: string
          project_id: string
          verification_id: string | null
          type: CommunicationType
          channel: 'email' | 'sms'
          recipient_email: string | null
          cc_emails: string[] | null
          subject: string | null
          body: string | null
          status: 'pending' | 'sent' | 'delivered' | 'opened' | 'failed'
          sent_at: string | null
          delivered_at: string | null
          opened_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subcontractor_id: string
          project_id: string
          verification_id?: string | null
          type: CommunicationType
          channel?: 'email' | 'sms'
          recipient_email?: string | null
          cc_emails?: string[] | null
          subject?: string | null
          body?: string | null
          status?: 'pending' | 'sent' | 'delivered' | 'opened' | 'failed'
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subcontractor_id?: string
          project_id?: string
          verification_id?: string | null
          type?: CommunicationType
          channel?: 'email' | 'sms'
          recipient_email?: string | null
          cc_emails?: string[] | null
          subject?: string | null
          body?: string | null
          status?: 'pending' | 'sent' | 'delivered' | 'opened' | 'failed'
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      exceptions: {
        Row: {
          id: string
          project_subcontractor_id: string
          verification_id: string | null
          issue_summary: string
          reason: string
          risk_level: 'low' | 'medium' | 'high'
          created_by_user_id: string
          approved_by_user_id: string | null
          approved_at: string | null
          expires_at: string | null
          expiration_type: 'until_resolved' | 'fixed_duration' | 'specific_date' | 'permanent'
          status: ExceptionStatus
          resolved_at: string | null
          resolution_type: 'coc_updated' | 'extended' | 'closed' | 'converted_permanent' | null
          resolution_notes: string | null
          supporting_document_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_subcontractor_id: string
          verification_id?: string | null
          issue_summary: string
          reason: string
          risk_level?: 'low' | 'medium' | 'high'
          created_by_user_id: string
          approved_by_user_id?: string | null
          approved_at?: string | null
          expires_at?: string | null
          expiration_type?: 'until_resolved' | 'fixed_duration' | 'specific_date' | 'permanent'
          status?: ExceptionStatus
          resolved_at?: string | null
          resolution_type?: 'coc_updated' | 'extended' | 'closed' | 'converted_permanent' | null
          resolution_notes?: string | null
          supporting_document_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_subcontractor_id?: string
          verification_id?: string | null
          issue_summary?: string
          reason?: string
          risk_level?: 'low' | 'medium' | 'high'
          created_by_user_id?: string
          approved_by_user_id?: string | null
          approved_at?: string | null
          expires_at?: string | null
          expiration_type?: 'until_resolved' | 'fixed_duration' | 'specific_date' | 'permanent'
          status?: ExceptionStatus
          resolved_at?: string | null
          resolution_type?: 'coc_updated' | 'extended' | 'closed' | 'converted_permanent' | null
          resolution_notes?: string | null
          supporting_document_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          entity_type: string
          entity_id: string
          action: string
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          entity_type: string
          entity_id: string
          action: string
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string | null
          entity_type?: string
          entity_id?: string
          action?: string
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      email_templates: {
        Row: {
          id: string
          company_id: string
          type: string
          name: string
          subject: string
          body: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type: string
          name: string
          subject: string
          body: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          type?: string
          name?: string
          subject?: string
          body?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      requirement_templates: {
        Row: {
          id: string
          company_id: string | null
          name: string
          type: 'commercial' | 'residential' | 'civil' | 'fitout' | 'custom'
          requirements: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          type?: 'commercial' | 'residential' | 'civil' | 'fitout' | 'custom'
          requirements: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          type?: 'commercial' | 'residential' | 'civil' | 'fitout' | 'custom'
          requirements?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
