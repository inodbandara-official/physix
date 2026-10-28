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
export type ContentLanguage = 'en' | 'si';
export type AssessmentKind =
  | 'practice'
  | 'class_test'
  | 'unit_test'
  | 'term_test'
  | 'mock_exam'
  | 'revision'
  | 'custom';
export type AssessmentStatus = 'draft' | 'published';
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded';

export type ProfileRow = {
  id: string;
  role: UserRole;
  full_name: string;
  preferred_name: string | null;
  email: string;
  avatar_url: string | null;
  /** Which language this person reads questions and the syllabus in. */
  language: ContentLanguage;
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
  /** Sinhala name. Null means Sinhala readers see the English one. */
  name_si: string | null;
  code: string | null;
  description: string | null;
  description_si: string | null;
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
  /** What a student sees before choosing a language of their own. */
  default_language: ContentLanguage;
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
  /** Languages the current version can actually be read in. */
  current_languages: ContentLanguage[];
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
  /** Prose translations keyed by language; validated before every write. */
  translations: Json;
  created_by: string | null;
  created_at: string;
}

export type QuestionTagRow = {
  question_id: string;
  tag: string;
  created_at: string;
}

export type AssessmentRow = {
  id: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  status: AssessmentStatus;
  opens_at: string | null;
  closes_at: string | null;
  time_limit_minutes: number | null;
  /** Null means unlimited. */
  max_attempts: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  /** numeric(5,2), returned as a string. */
  pass_percentage: string | null;
  /** numeric(4,3): fraction of a question's marks lost for a wrong MCQ / true-false answer. */
  negative_marking: string;
  show_results_immediately: boolean;
  show_correct_answers: boolean;
  show_explanations: boolean;
  allow_review: boolean;
  results_released_at: string | null;
  /** The single assessment that past-paper practice runs through. */
  past_paper_bank: boolean;
  created_by: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AssessmentBatchRow = {
  assessment_id: string;
  batch_id: string;
  created_at: string;
}

export type AssessmentItemRow = {
  id: string;
  assessment_id: string;
  position: number;
  kind: 'question' | 'random';
  question_id: string | null;
  pick_count: number | null;
  syllabus_node_id: string | null;
  difficulties: DifficultyLevel[];
  question_types: QuestionType[];
  marks: string | null;
  created_at: string;
}

export type AttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: AttemptStatus;
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  /** Maintained by trigger from attempt_questions. Never written by the app. */
  score: string;
  max_score: string;
  percentage: string | null;
  pending_manual: number;
  /** What a past-paper practice covered, e.g. "2019 Paper II · Section B". */
  practice_label: string | null;
  created_at: string;
  updated_at: string;
}

export type AttemptQuestionRow = {
  id: string;
  attempt_id: string;
  position: number;
  question_id: string;
  /** The exact version served. Past attempts replay against this, never the current version. */
  question_version_id: string;
  max_marks: string;
  marks_awarded: string | null;
  is_correct: boolean | null;
  requires_manual: boolean;
  feedback: string | null;
  part_results: Json | null;
  teacher_comment: string | null;
  marked_by: string | null;
  marked_at: string | null;
  /** Copied from the question when served, for analytics. */
  node_id: string | null;
  unit_id: string | null;
  difficulty: DifficultyLevel | null;
  question_type: QuestionType | null;
}

export type AttemptAnswerRow = {
  attempt_question_id: string;
  attempt_id: string;
  response: Json | null;
  flagged: boolean;
  updated_at: string;
}

export type PastPaperRow = {
  id: string;
  year: number;
  title: string;
  description: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type PastPaperQuestionRow = {
  paper_id: string;
  question_id: string;
  question_number: string;
  section: string | null;
  position: number;
  created_at: string;
}

export type RankingBasis = 'average' | 'total' | 'weighted' | 'recent';
export type RankingVisibility = 'private' | 'anonymous' | 'batch';

export type RankingSettingsRow = {
  id: boolean;
  basis: RankingBasis;
  recent_count: number;
  weights: Json;
  missed_counts_zero: boolean;
  student_visibility: RankingVisibility;
  updated_at: string;
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
      assessments: {
        Row: AssessmentRow;
        Insert: Insert<AssessmentRow, 'title'>;
        Update: Partial<AssessmentRow>;
        Relationships: [];
      };
      assessment_batches: {
        Row: AssessmentBatchRow;
        Insert: Insert<AssessmentBatchRow, 'assessment_id' | 'batch_id'>;
        Update: Partial<AssessmentBatchRow>;
        Relationships: [];
      };
      assessment_items: {
        Row: AssessmentItemRow;
        Insert: Insert<AssessmentItemRow, 'assessment_id' | 'position' | 'kind'>;
        Update: Partial<AssessmentItemRow>;
        Relationships: [];
      };
      attempts: {
        Row: AttemptRow;
        Insert: Insert<AttemptRow, 'assessment_id' | 'student_id' | 'attempt_number'>;
        Update: Partial<AttemptRow>;
        Relationships: [];
      };
      attempt_questions: {
        Row: AttemptQuestionRow;
        Insert: Insert<
          AttemptQuestionRow,
          'attempt_id' | 'position' | 'question_id' | 'question_version_id' | 'max_marks'
        >;
        Update: Partial<AttemptQuestionRow>;
        Relationships: [];
      };
      attempt_answers: {
        Row: AttemptAnswerRow;
        Insert: Insert<AttemptAnswerRow, 'attempt_question_id' | 'attempt_id'>;
        Update: Partial<AttemptAnswerRow>;
        Relationships: [];
      };
      past_papers: {
        Row: PastPaperRow;
        Insert: Insert<PastPaperRow, 'year' | 'title'>;
        Update: Partial<PastPaperRow>;
        Relationships: [];
      };
      past_paper_questions: {
        Row: PastPaperQuestionRow;
        Insert: Insert<PastPaperQuestionRow, 'paper_id' | 'question_id' | 'question_number'>;
        Update: Partial<PastPaperQuestionRow>;
        Relationships: [];
      };
      ranking_settings: {
        Row: RankingSettingsRow;
        Insert: Partial<RankingSettingsRow>;
        Update: Partial<RankingSettingsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_teacher: { Args: Record<string, never>; Returns: boolean };
      current_student_id: { Args: Record<string, never>; Returns: string | null };
      start_attempt: { Args: { p_assessment_id: string; p_filter?: Json }; Returns: string };
      past_paper_question_count: { Args: { p_filter: Json }; Returns: number | null };
      assessment_question_count: { Args: { p_assessment_id: string }; Returns: number | null };
      finalize_attempt: { Args: { p_attempt_id: string; p_results: Json }; Returns: AttemptStatus };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      syllabus_kind: SyllabusKind;
      question_type: QuestionType;
      question_status: QuestionStatus;
      difficulty_level: DifficultyLevel;
      content_language: ContentLanguage;
      assessment_kind: AssessmentKind;
      assessment_status: AssessmentStatus;
      attempt_status: AttemptStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
