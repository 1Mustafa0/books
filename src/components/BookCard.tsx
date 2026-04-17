import React from 'react';
import { motion } from 'motion/react';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Book as BookIcon, User as UserIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Book, Chapter } from '@/src/types';
import { Language } from '@/src/translations';

interface BookCardProps {
  book: Book;
  chapters: Chapter[];
  index: number;
  language: Language;
  onClick: () => void;
}

export function BookCard({ book, chapters, index, language, onClick }: BookCardProps) {
  const progress = Math.min(100, (chapters.length / book.totalChapters) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className="group hover:scale-[1.02] transition-all cursor-pointer glass border-transparent hover:border-primary/30 overflow-hidden flex flex-col card-glow"
        onClick={onClick}
      >
        <div className="relative h-52 overflow-hidden">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-orange-500/5 flex items-center justify-center">
              <BookIcon className="w-16 h-16 text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-5 right-5 left-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                {language === 'ar' ? 'الإنجاز' : 'Progress'}
              </span>
              <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: 'circOut' }}
                className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
              />
            </div>
          </div>
        </div>

        <CardHeader className="p-6 pb-3 flex-1">
          <div className="flex justify-between items-start gap-3">
            <CardTitle className="text-lg font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {book.title}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] shrink-0 border px-2 py-0.5',
                progress === 100
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-primary/5 border-primary/20 text-primary'
              )}
            >
              {progress === 100
                ? language === 'ar' ? 'مكتمل' : 'Done'
                : language === 'ar' ? 'قيد الدراسة' : 'Studying'}
            </Badge>
          </div>
          {book.author && (
            <CardDescription className="text-muted-foreground text-xs mt-2 flex items-center gap-1.5">
              <UserIcon className="w-3 h-3" />
              {book.author}
            </CardDescription>
          )}
        </CardHeader>

        <CardFooter className="px-6 py-4 flex items-center justify-between border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold mb-0.5">
              {language === 'ar' ? 'الفصول' : 'Chapters'}
            </span>
            <span className="text-sm font-bold text-white">
              {chapters.length} / {book.totalChapters}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all">
            <ChevronRight className={cn('w-5 h-5 transition-transform group-hover:scale-110', language === 'en' && 'rotate-180')} />
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
