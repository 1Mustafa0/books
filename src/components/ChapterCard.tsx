import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Clock, CircleCheck as CheckCircle2, CreditCard as Edit, Trash2, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chapter, Review } from '@/src/types';
import { Language } from '@/src/translations';
import { Tooltip } from './Tooltip';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { isBefore } from 'date-fns';

interface ChapterCardProps {
  chapter: Chapter;
  review?: Review;
  index: number;
  language: Language;
  t: any;
  onEdit: () => void;
  onDelete: () => void;
  onOpenEditor: () => void;
  onStartReview: () => void;
}

export function ChapterCard({ chapter, review, index, language, t, onEdit, onDelete, onOpenEditor, onStartReview }: ChapterCardProps) {
  const isDue = review && (isBefore(review.nextReviewDate.toDate(), new Date()) || review.status === 'new');

  const nextReviewText = review && review.status !== 'new'
    ? format(review.nextReviewDate.toDate(), 'd MMM yyyy', { locale: language === 'ar' ? ar : undefined })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={cn(
        "glass hover:border-primary/30 transition-all group overflow-hidden card-glow",
        isDue && "border-amber-500/20"
      )}>
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-105",
              isDue
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-green-500/10 border-green-500/20 text-green-400"
            )}>
              {isDue ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors truncate">
                {chapter.title}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {isDue ? (
                  <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 border text-[10px] px-2 py-0">
                    {t.chapter.dueNow}
                  </Badge>
                ) : nextReviewText ? (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.chapter.reviewDate}: {nextReviewText}
                  </span>
                ) : null}
                {review && (
                  <span className="text-[11px] text-muted-foreground">
                    {t.chapter.easeFactor}: {review.easeFactor.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Tooltip content={t.chapter.editTitle} position="top">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 border border-white/5 hover:bg-white/10 rounded-xl"
                onClick={onEdit}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content={t.chapter.deleteChapter} position="top">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 border border-destructive/10 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Tooltip>
            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4 border-white/10 hover:bg-white/10 rounded-xl font-medium text-xs"
              onClick={onOpenEditor}
            >
              <Map className={cn("w-3.5 h-3.5", language === 'ar' ? "ml-1.5" : "mr-1.5")} />
              {t.chapter.editMap}
            </Button>
            {isDue && (
              <Button
                size="sm"
                className="h-9 px-4 bg-primary hover:bg-primary/90 rounded-xl font-bold text-xs shadow-lg shadow-primary/20"
                onClick={onStartReview}
              >
                <Brain className={cn("w-3.5 h-3.5", language === 'ar' ? "ml-1.5" : "mr-1.5")} />
                {t.chapter.startReview}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
