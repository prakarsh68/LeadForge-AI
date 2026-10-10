import React from 'react';

interface UserAvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Clean, accessible initials-based avatar component.
 * Replaces external AI and stock photos with deterministic, professional vector badges.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  size = 'md',
  className = '',
}) => {
  const getInitials = (fullName: string): string => {
    if (!fullName || typeof fullName !== 'string') return 'LF';
    const trimmed = fullName.trim();
    if (!trimmed) return 'LF';

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Deterministic color palette based on name hash for consistent branding
  const colorSchemes = [
    'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    'bg-blue-50 text-blue-700 border-blue-200/80',
    'bg-violet-50 text-violet-700 border-violet-200/80',
    'bg-sky-50 text-sky-700 border-sky-200/80',
    'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    'bg-amber-50 text-amber-800 border-amber-200/80',
    'bg-rose-50 text-rose-700 border-rose-200/80',
    'bg-slate-100 text-slate-700 border-slate-200/80',
  ];

  let hash = 0;
  const safeName = name || 'LeadForge';
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colorSchemes[Math.abs(hash) % colorSchemes.length];

  const sizeClasses = {
    xs: 'h-5 w-5 text-[9px] font-semibold',
    sm: 'h-7 w-7 text-[11px] font-bold',
    md: 'h-9 w-9 text-xs font-bold',
    lg: 'h-12 w-12 text-sm font-bold',
    xl: 'h-16 w-16 text-base font-extrabold',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full uppercase tracking-wider border shrink-0 select-none shadow-2xs font-[Plus_Jakarta_Sans] ${color} ${sizeClasses} ${className}`}
      title={safeName}
      aria-label={safeName}
    >
      {getInitials(safeName)}
    </div>
  );
};

