import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  Cog,
  Columns3,
  Contact,
  Crown,
  DollarSign,
  Eye,
  FileText,
  FileWarning,
  Flame,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Package,
  QrCode,
  Receipt,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Store,
  Users,
  Wrench,
} from 'lucide-react';
import menuItems from '../../config/menuItems.json';

export type MenuGroup = 'operacao' | 'campo' | 'gestao' | 'planejamento' | 'apoio';

export interface MenuConfigItem {
  id: string;
  label: string;
  mobileLabel: string;
  icon: string;
  rota: string;
  minRole: number;
  group: MenuGroup;
  hiddenByDefault?: boolean;
}

export const menuCatalog = menuItems as MenuConfigItem[];

export const GROUP_LABELS: Record<MenuGroup, string> = {
  operacao: 'Operação',
  campo: 'Campo',
  gestao: 'Gestão',
  planejamento: 'Planejamento',
  apoio: 'Apoio',
};

const iconMap: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  Cog,
  Columns3,
  Contact,
  Crown,
  DollarSign,
  Eye,
  FileText,
  FileWarning,
  Flame,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Package,
  QrCode,
  Receipt,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Store,
  Users,
  Wrench,
};

export function renderMenuIcon(iconName: string, size = 20) {
  const Icon = iconMap[iconName] ?? LayoutDashboard;
  return <Icon size={size} />;
}
