import {
  BookOpen,
  FileQuestion,
  LayoutDashboard,
  Layers,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Navigation lists only routes that actually exist. The remaining sections
 * from the product brief (Assessments, Rankings, Analytics, Past Papers,
 * Materials, Formula Vault, Announcements) are added here as each phase
 * lands, so the sidebar never advertises a dead end.
 */
export const TEACHER_NAV: NavItem[] = [
  { href: '/t/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/t/students', label: 'Students', icon: Users },
  { href: '/t/batches', label: 'Batches', icon: Layers },
  { href: '/t/questions', label: 'Question Bank', icon: FileQuestion },
  { href: '/t/syllabus', label: 'Syllabus', icon: BookOpen },
  { href: '/t/settings', label: 'Settings', icon: Settings },
];

export const STUDENT_NAV: NavItem[] = [
  { href: '/s/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/s/syllabus', label: 'Syllabus', icon: BookOpen },
  { href: '/s/profile', label: 'Profile', icon: User },
];
