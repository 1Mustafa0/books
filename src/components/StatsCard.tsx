import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Video as LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  index: number;
}

export function StatsCard({ label, value, icon: Icon, color, bg, index }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08 }}
    >
      <Card className="glass border-white/5 hover:border-primary/20 transition-all group overflow-hidden">
        <CardContent className="p-6 flex items-center gap-5">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
            bg
          )}>
            <Icon className={cn("w-6 h-6", color)} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
            <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
