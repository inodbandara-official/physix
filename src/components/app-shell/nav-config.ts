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

import type { UserRole } from '@/types/database';

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

/**
 * A `NavItem` carries an icon, which is a React component — a function, and
 * therefore not serialisable across the server/client boundary. So the
 * server passes a *role* and the client components look their own items up
 * here, rather than receiving the list as a prop.
 */
export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  teacher: TEACHER_NAV,
  student: STUDENT_NAV,
};
