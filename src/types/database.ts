/**
 * Hand-maintained mirror of `supabase/migrations`.
 *
 * Regenerate-by-hand rule: when you add a migration, update this file in the
 * same commit. Keeping it hand-written (rather than generated) means the app
 * has no build-time dependency on a live database, which keeps CI and Vercel
 * builds hermetic.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = 'teacher' | 'student';
export type AccountStatus = 'active' | 'inactive' | 'suspended';
export type SyllabusKind = 'unit' | 'topic' | 'subtopic';

export type QuestionType =
  | 'mcq'
  | 'multi'
  | 'true_false'
  | 'numerical'
  | 'short_answer'
  | 'structured'
  | 'essay';
export type QuestionStatus = 'draft' | 'published' | 'archived';
export type DifficultyLevel = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';

export type ProfileRow = {
  id: string;
  role: UserRole;
  full_name: string;
  preferred_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentRow = {
  id: string;
  profile_id: string | null;
  student_code: string;
  username: string;
  full_name: string;
  preferred_name: string | null;
  /** The student's own email: what they sign in with, and where notifications go. */
  email: string | null;
  /** The address the auth account actually uses — `email`, or the username fallback. */
  login_email: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  school: string | null;
  district: string | null;
  al_year: number | null;
  status: AccountStatus;
  joined_on: string;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BatchRow = {
  id: string;
  name: string;
  code: string | null;
  al_year: number | null;
  description: string | null;
  schedule_note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BatchMemberRow = {
  batch_id: string;
  student_id: string;
  joined_at: string;
  left_at: string | null;
}

export type SyllabusNodeRow = {
  id: string;
  parent_id: string | null;
  kind: SyllabusKind;
  name: string;
  code: string | null;
  description: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentNoteRow = {
  id: string;
  student_id: string;
  author_id: string | null;
  body: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type AppSettingsRow = {
  id: boolean;
  lms_name: string;
  tagline: string;
  teacher_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  updated_at: string;
}

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Json;
  created_at: string;
}

export type QuestionRow = {
  id: string;
  question_code: string;
  status: QuestionStatus;
  current_version_id: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Snapshot of the current version, maintained by trigger so the bank can
   * be filtered and searched without joining. Never written by the app.
   */
  current_version_number: number | null;
  current_type: QuestionType | null;
  current_title: string | null;
  current_stem: string | null;
  current_marks: string | null;
  current_difficulty: DifficultyLevel | null;
  current_node_id: string | null;
  current_unit_id: string | null;
  current_year: number | null;
  current_seconds: number | null;
}

export type QuestionVersionRow = {
  id: string;
  question_id: string;
  version_number: number;
  type: QuestionType;
  title: string;
  stem: string;
  /** Validated against `questionBodySchema` before every write. */
  body: Json;
  /** numeric(6,2) — PostgREST returns it as a string to preserve precision. */
  marks: string;
  difficulty: DifficultyLevel;
  estimated_seconds: number | null;
  syllabus_node_id: string | null;
  unit_id: string | null;
  source: string | null;
  source_year: number | null;
  paper_reference: string | null;
  explanation: string | null;
  solution: string | null;
  common_mistake: string | null;
  hint: string | null;
  teacher_notes: string | null;
  figures: Json;
  created_by: string | null;
  created_at: string;
}

export type QuestionTagRow = {
  question_id: string;
  tag: string;
  created_at: string;
}

/**
 * Insert shape: the listed columns are required, everything else is optional
 * because the database supplies a default (id, timestamps, status, …).
 */
type Insert<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insert<ProfileRow, 'id'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      students: {
        Row: StudentRow;
        Insert: Insert<StudentRow, 'student_code' | 'username' | 'full_name'>;
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      batches: {
        Row: BatchRow;
        Insert: Insert<BatchRow, 'name'>;
        Update: Partial<BatchRow>;
        Relationships: [];
      };
      batch_members: {
        Row: BatchMemberRow;
        Insert: Insert<BatchMemberRow, 'batch_id' | 'student_id'>;
        Update: Partial<BatchMemberRow>;
        Relationships: [];
      };
      syllabus_nodes: {
        Row: SyllabusNodeRow;
        Insert: Insert<SyllabusNodeRow, 'kind' | 'name'>;
        Update: Partial<SyllabusNodeRow>;
        Relationships: [];
      };
      student_notes: {
        Row: StudentNoteRow;
        Insert: Insert<StudentNoteRow, 'student_id' | 'body'>;
        Update: Partial<StudentNoteRow>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSettingsRow;
        Insert: Partial<AppSettingsRow>;
        Update: Partial<AppSettingsRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Insert<AuditLogRow, 'action' | 'entity_type' | 'summary'>;
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      questions: {
        Row: QuestionRow;
        Insert: Insert<QuestionRow, 'question_code'>;
        Update: Partial<QuestionRow>;
        Relationships: [];
      };
      question_versions: {
        Row: QuestionVersionRow;
        Insert: Insert<QuestionVersionRow, 'question_id' | 'version_number' | 'type' | 'stem'>;
        Update: Partial<QuestionVersionRow>;
        Relationships: [];
      };
      question_tags: {
        Row: QuestionTagRow;
        Insert: Insert<QuestionTagRow, 'question_id' | 'tag'>;
        Update: Partial<QuestionTagRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_teacher: { Args: Record<string, never>; Returns: boolean };
      current_student_id: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      syllabus_kind: SyllabusKind;
      question_type: QuestionType;
      question_status: QuestionStatus;
      difficulty_level: DifficultyLevel;
    };
    CompositeTypes: Record<string, never>;
  };
}
