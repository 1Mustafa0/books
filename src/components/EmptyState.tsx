import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Video as LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center space-y-6"
    >
      <div className="w-20 h-20 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-center">
        <Icon className="w-10 h-10 text-primary/30" />
      </div>
      <div className="space-y-2 max-w-xs">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="h-11 px-8 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
