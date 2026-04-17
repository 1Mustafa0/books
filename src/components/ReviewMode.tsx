import React, { useState } from 'react';
import { MindMapEditor } from './MindMapEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewModeProps {
  chapterTitle: string;
  originalMindMap: any;
  onComplete: (quality: number) => void;
  onCancel: () => void;
}

export function ReviewMode({ chapterTitle, originalMindMap, onComplete, onCancel }: ReviewModeProps) {
  const [step, setStep] = useState<'recall' | 'compare'>('recall');
  const [recallMindMap, setRecallMindMap] = useState<any>(null);
  const [rating, setRating] = useState<number | null>(null);

  const handleRecallSave = (data: any) => {
    setRecallMindMap(data);
    setStep('compare');
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary/80">جلسة مراجعة</span>
          <h2 className="text-4xl font-bold text-white leading-tight">{chapterTitle}</h2>
          <p className="text-muted-foreground font-medium">
            {step === 'recall' ? 'ارسم الخريطة الذهنية من ذاكرتك' : 'قارن بين ما تذكرته والخريطة الأصلية'}
          </p>
        </div>
        <Button variant="ghost" className="hover:bg-white/10" onClick={onCancel}>إلغاء المراجعة</Button>
      </div>

      {step === 'recall' ? (
        <div className="flex-1 glass rounded-3xl overflow-hidden relative group">
          <MindMapEditor onSave={handleRecallSave} />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass px-6 py-3 rounded-2xl text-sm font-medium text-muted-foreground animate-pulse pointer-events-none">
            عند الانتهاء، اضغط على "حفظ الخريطة" للمقارنة
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-8">
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4">ما تذكرته</span>
              <div className="flex-1 glass rounded-3xl overflow-hidden">
                <MindMapEditor initialData={recallMindMap} onSave={() => {}} readOnly />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-4">الخريطة الأصلية</span>
              <div className="flex-1 glass rounded-3xl overflow-hidden border-primary/20">
                <MindMapEditor initialData={originalMindMap} onSave={() => {}} readOnly />
              </div>
            </div>
          </div>

          <Card className="glass border-primary/20 bg-primary/5 overflow-hidden">
            <CardContent className="py-10 flex flex-col items-center space-y-8">
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-bold text-white">قيم استذكارك</h3>
                <p className="text-sm text-muted-foreground">كيف كان أداؤك في استرجاع المعلومات؟</p>
              </div>
              
              <div className="flex flex-wrap justify-center gap-4">
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <Button
                    key={val}
                    variant={rating === val ? 'default' : 'outline'}
                    className={cn(
                      "w-16 h-16 rounded-2xl text-xl font-bold transition-all",
                      rating === val 
                        ? "scale-110 shadow-[0_0_30px_rgba(242,125,38,0.4)]" 
                        : "glass border-white/10 hover:bg-white/10"
                    )}
                    onClick={() => setRating(val)}
                  >
                    {val}
                  </Button>
                ))}
              </div>
              
              <div className="flex gap-12 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-destructive" /> نسيان تام</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> استذكار مثالي</span>
              </div>

              <Button 
                disabled={rating === null} 
                className="w-full max-w-md h-14 text-lg font-bold shadow-xl shadow-primary/20"
                onClick={() => rating !== null && onComplete(rating)}
              >
                تأكيد التقييم وإنهاء الجلسة
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
