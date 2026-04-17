/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Book, Chapter, Review } from './types';
import { calculateNextReview } from './lib/spacedRepetition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, LogOut, Brain, Calendar, ChevronRight, Book as BookIcon, Clock, CircleCheck as CheckCircle2, CreditCard as Edit, Trash2, TriangleAlert as AlertTriangle, User as UserIcon, TrendingUp, Award, Zap, ArrowRight, Sparkles, LayoutDashboard, Info, Circle as HelpCircle, Menu, Save, Languages } from 'lucide-react';
import { MindMapEditor } from './components/MindMapEditor';
import { ReviewMode } from './components/ReviewMode';
import { BookCard } from './components/BookCard';
import { ChapterCard } from './components/ChapterCard';
import { StatsCard } from './components/StatsCard';
import { EmptyState } from './components/EmptyState';
import { format, isBefore, startOfDay, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip } from './components/Tooltip';
import { translations, Language } from './translations';

type View = 'dashboard' | 'book-detail' | 'editor' | 'review' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [language, setLanguage] = useState<Language>('ar');
  const t = translations[language];

  const [books, setBooks] = useState<Book[]>([]);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [isDeletingBook, setIsDeletingBook] = useState<string | null>(null);
  const [isEditingBook, setIsEditingBook] = useState<Book | null>(null);
  const [isEditingChapter, setIsEditingChapter] = useState<Chapter | null>(null);
  const [isDeletingChapter, setIsDeletingChapter] = useState<string | null>(null);
  const [coverBase64, setCoverBase64] = useState<string>('');

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const booksQuery = query(collection(db, 'books'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribeBooks = onSnapshot(booksQuery, (snapshot) => {
      setBooks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Book)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'books'));

    const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', user.uid));
    const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
      setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reviews'));

    const allChaptersQuery = query(collection(db, 'chapters'), where('userId', '==', user.uid));
    const unsubscribeAllChapters = onSnapshot(allChaptersQuery, (snapshot) => {
      setAllChapters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chapters'));

    return () => {
      unsubscribeBooks();
      unsubscribeReviews();
      unsubscribeAllChapters();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedBook) return;

    const chaptersQuery = query(
      collection(db, 'chapters'),
      where('bookId', '==', selectedBook.id),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'asc')
    );
    const unsubscribeChapters = onSnapshot(chaptersQuery, (snapshot) => {
      setChapters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chapters'));

    return unsubscribeChapters;
  }, [user, selectedBook]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        toast.error(language === 'ar' ? 'تم حظر النافذة المنبثقة. يرجى السماح بالمنبثقات.' : 'Popup blocked. Please allow popups for this site.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        // silent
      } else if (err.code !== 'auth/cancelled-popup-request') {
        toast.error(language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const addBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string).trim();
    const author = (formData.get('author') as string).trim();
    const totalChapters = parseInt(formData.get('totalChapters') as string) || 1;

    try {
      const bookData: any = {
        title,
        author: author || '',
        totalChapters,
        userId: user.uid,
        createdAt: Timestamp.now(),
      };
      if (coverBase64) bookData.coverUrl = coverBase64;

      await addDoc(collection(db, 'books'), bookData);
      setIsAddingBook(false);
      setCoverBase64('');
      (e.target as HTMLFormElement).reset();
      toast.success(language === 'ar' ? 'تمت إضافة الكتاب بنجاح' : 'Book added successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'books');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      toast.error(language === 'ar' ? 'حجم الصورة كبير جداً. الحد الأقصى 500 كيلوبايت.' : 'Image too large. Max 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setCoverBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addChapter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedBook || isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string).trim();

    try {
      const chapterRef = await addDoc(collection(db, 'chapters'), {
        bookId: selectedBook.id,
        title,
        mindMap: JSON.stringify({
          nodes: [{ id: 'root', type: 'mindMap', data: { label: title }, position: { x: 250, y: 5 } }],
          edges: []
        }),
        userId: user.uid,
        createdAt: Timestamp.now(),
      });

      await setDoc(doc(db, 'reviews', chapterRef.id), {
        chapterId: chapterRef.id,
        userId: user.uid,
        nextReviewDate: Timestamp.fromDate(addDays(startOfDay(new Date()), 1)),
        interval: 0,
        easeFactor: 2.5,
        status: 'new'
      });

      setIsAddingChapter(false);
      (e.target as HTMLFormElement).reset();
      toast.success(language === 'ar' ? 'تمت إضافة الفصل بنجاح' : 'Chapter added successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chapters');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteBook = async (bookId: string) => {
    try {
      const bookChapters = allChapters.filter(c => c.bookId === bookId);
      for (const chapter of bookChapters) {
        await deleteDoc(doc(db, 'reviews', chapter.id));
        await deleteDoc(doc(db, 'chapters', chapter.id));
      }
      await deleteDoc(doc(db, 'books', bookId));
      setIsDeletingBook(null);
      setSelectedBook(null);
      setView('dashboard');
      toast.success(language === 'ar' ? 'تم حذف الكتاب بنجاح' : 'Book deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `books/${bookId}`);
    }
  };

  const updateBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !isEditingBook || isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string).trim();
    const author = (formData.get('author') as string).trim();
    const totalChapters = parseInt(formData.get('totalChapters') as string) || 1;

    try {
      const updateData: any = { title, author: author || '', totalChapters };
      if (coverBase64) updateData.coverUrl = coverBase64;

      await updateDoc(doc(db, 'books', isEditingBook.id), updateData);
      if (selectedBook?.id === isEditingBook.id) {
        setSelectedBook({ ...selectedBook, ...updateData });
      }
      setIsEditingBook(null);
      setCoverBase64('');
      toast.success(language === 'ar' ? 'تم تحديث الكتاب بنجاح' : 'Book updated successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `books/${isEditingBook.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteChapter = async (chapterId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', chapterId));
      await deleteDoc(doc(db, 'chapters', chapterId));
      setIsDeletingChapter(null);
      toast.success(language === 'ar' ? 'تم حذف الفصل بنجاح' : 'Chapter deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chapters/${chapterId}`);
    }
  };

  const updateChapter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !isEditingChapter || isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string).trim();

    try {
      await updateDoc(doc(db, 'chapters', isEditingChapter.id), { title });
      setIsEditingChapter(null);
      toast.success(language === 'ar' ? 'تم تحديث العنوان بنجاح' : 'Title updated successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chapters/${isEditingChapter.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveMindMap = async (data: any, silent = false) => {
    if (!selectedChapter) return;
    try {
      await updateDoc(doc(db, 'chapters', selectedChapter.id), {
        mindMap: JSON.stringify(data)
      });

      const review = reviews.find(r => r.chapterId === selectedChapter.id);
      if (review && review.status === 'new') {
        await updateDoc(doc(db, 'reviews', review.id), {
          nextReviewDate: Timestamp.fromDate(addDays(startOfDay(new Date()), 2)),
          status: 'learning'
        });
      }

      if (!silent) {
        toast.success(language === 'ar' ? 'تم حفظ الخريطة الذهنية' : 'Mind map saved');
        setView('book-detail');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chapters/${selectedChapter.id}`);
    }
  };

  const completeReview = async (quality: number) => {
    if (!selectedChapter) return;
    const review = reviews.find(r => r.chapterId === selectedChapter.id);
    if (!review) return;

    const next = calculateNextReview(quality, review.interval, review.easeFactor);

    try {
      await updateDoc(doc(db, 'reviews', review.id), {
        ...next,
        lastReviewedAt: Timestamp.now()
      });
      toast.success(language === 'ar' ? 'تم تحديث موعد المراجعة' : 'Review scheduled');
      setView('book-detail');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
    }
  };

  const dueReviews = useMemo(() => {
    const today = startOfDay(new Date());
    return reviews.filter(r => isBefore(r.nextReviewDate.toDate(), today) || r.status === 'new');
  }, [reviews]);

  const retentionRate = useMemo(() => {
    const totalExpected = books.reduce((acc, b) => acc + b.totalChapters, 0);
    if (!totalExpected) return '0%';
    return `${Math.round((allChapters.length / totalExpected) * 100)}%`;
  }, [books, allChapters]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background font-sans text-foreground overflow-hidden" dir="rtl">
        <div className="atmosphere" />

        <nav className="fixed top-0 w-full z-50 glass border-b border-white/5">
          <div className="container max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-black" />
              </div>
              <span className="text-lg font-bold text-primary">MindShelf</span>
            </div>
            <Button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="h-9 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 text-black"
            >
              {isLoggingIn ? '...' : language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
            </Button>
          </div>
        </nav>

        <main className="relative pt-28 pb-20">
          <section className="container max-w-5xl mx-auto px-6 text-center space-y-10 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="space-y-5"
            >
              <Badge variant="outline" className="px-4 py-1 rounded-full border-primary/30 text-primary bg-primary/5 text-xs font-bold tracking-widest uppercase">
                <Sparkles className="w-3 h-3 ml-2" />
                {language === 'ar' ? 'مستقبلك الدراسي يبدأ هنا' : 'Your Learning Journey Starts Here'}
              </Badge>
              <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight">
                {language === 'ar' ? (
                  <>حوّل كتبك إلى <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-primary">خرائط ذهنية</span></>
                ) : (
                  <>Turn Books Into <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-primary">Mind Maps</span></>
                )}
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {language === 'ar'
                  ? 'رفيقك الذكي لتنظيم المعرفة، يجمع بين قوة الخرائط الذهنية وتقنيات التكرار المتباعد.'
                  : 'Your smart knowledge companion — combining mind maps with spaced repetition to retain information forever.'}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col md:flex-row gap-3 justify-center"
            >
              <Button
                size="lg"
                onClick={handleLogin}
                className="h-12 px-8 text-base font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 rounded-2xl group"
              >
                {language === 'ar' ? 'ابدأ رحلة التعلم' : 'Start Learning'}
                <ArrowRight className="mr-2 w-5 h-5 transition-transform group-hover:-translate-x-1" />
              </Button>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
              {[
                {
                  title: language === 'ar' ? 'خرائط ذهنية تفاعلية' : 'Interactive Mind Maps',
                  desc: language === 'ar' ? 'صمم أفكارك بصرياً واربط بين المفاهيم بسهولة.' : 'Visually design ideas and connect concepts with ease.',
                  icon: Brain,
                  color: 'text-orange-400',
                  bg: 'bg-orange-500/10'
                },
                {
                  title: language === 'ar' ? 'التكرار المتباعد' : 'Spaced Repetition',
                  desc: language === 'ar' ? 'خوارزمية تذكرك بالمراجعة في الوقت المثالي.' : 'Smart algorithm that reminds you to review at the perfect time.',
                  icon: Zap,
                  color: 'text-blue-400',
                  bg: 'bg-blue-500/10'
                },
                {
                  title: language === 'ar' ? 'تتبع التقدم' : 'Track Progress',
                  desc: language === 'ar' ? 'تابع تطورك وشاهد مكتبتك تنمو يوماً بعد يوم.' : 'Follow your growth and watch your library expand daily.',
                  icon: TrendingUp,
                  color: 'text-green-400',
                  bg: 'bg-green-500/10'
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <Card className="glass border-white/5 hover:border-primary/20 transition-all p-6 text-right group h-full">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", feature.bg)}>
                      <feature.icon className={cn("w-6 h-6", feature.color)} />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="absolute top-1/3 -left-32 w-96 h-96 bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/3 -right-32 w-96 h-96 bg-blue-500/8 rounded-full blur-[120px] pointer-events-none" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="atmosphere" />

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          "h-full glass-dark flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden shrink-0",
          sidebarCollapsed ? "w-0 border-none" : "w-[260px] border-r border-white/5"
        )}>
          <div className="w-[260px] h-full flex flex-col overflow-y-auto">
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-black" />
                  </div>
                  <span className="text-base font-bold text-primary tracking-wide">MindShelf</span>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content={language === 'ar' ? 'Switch to English' : 'تغيير للعربية'} position="bottom">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 hover:bg-white/10 text-muted-foreground"
                      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                    >
                      <Languages className="w-3.5 h-3.5" />
                    </Button>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 hover:bg-white/10 text-muted-foreground"
                    onClick={() => setSidebarCollapsed(true)}
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* User */}
              <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                <div className="relative shrink-0">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-9 h-9 rounded-lg object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user?.displayName || (language === 'ar' ? 'المستخدم' : 'User')}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>

              {/* Nav */}
              <nav className="space-y-1 flex-1">
                {[
                  { icon: LayoutDashboard, label: t.dashboard, viewKey: 'dashboard' as View },
                  { icon: UserIcon, label: language === 'ar' ? 'الملف الشخصي' : 'Profile', viewKey: 'profile' as View },
                ].map(({ icon: Icon, label, viewKey }) => (
                  <Button
                    key={viewKey}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-10 px-3 rounded-xl text-sm transition-all",
                      view === viewKey
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    )}
                    onClick={() => setView(viewKey)}
                  >
                    <Icon className={cn("w-4 h-4", language === 'ar' ? "ml-2.5" : "mr-2.5")} />
                    {label}
                  </Button>
                ))}
              </nav>

              <div className="pt-4 border-t border-white/5">
                <Button
                  variant="ghost"
                  className="w-full justify-center h-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl text-sm"
                  onClick={handleLogout}
                >
                  <LogOut className={cn("w-4 h-4", language === 'ar' ? "ml-2" : "mr-2")} />
                  {t.logout}
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className={cn(
          "flex-1 h-full relative z-10",
          view === 'editor' ? "overflow-hidden" : "overflow-y-auto"
        )}>
          {/* Sidebar Toggle */}
          <div className={cn(
            "fixed top-5 z-40 transition-all duration-300",
            language === 'ar' ? "right-5" : "left-5",
            !sidebarCollapsed && (language === 'ar' ? "right-[285px]" : "left-[285px]"),
            view === 'editor' && "opacity-0 pointer-events-none"
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl glass-dark border border-white/10 text-primary hover:scale-110 transition-all shadow-xl"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          <div className={cn(
            "mx-auto transition-all duration-300 h-full",
            view === 'editor' ? "w-full max-w-none p-0" : "container max-w-5xl px-6 pt-16 pb-12"
          )}>
            <AnimatePresence mode="wait">
              {/* ---- PROFILE ---- */}
              {view === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden glass border border-primary/20">
                        <img
                          src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-primary rounded-lg flex items-center justify-center border-2 border-background">
                        <Award className="w-3.5 h-3.5 text-black" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white">{user?.displayName}</h2>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        {language === 'ar' ? 'عضو نشط منذ ' : 'Member since '}
                        {user?.metadata.creationTime
                          ? format(new Date(user.metadata.creationTime), 'MMMM yyyy', { locale: language === 'ar' ? ar : undefined })
                          : '...'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: t.stats.totalBooks, value: books.length, icon: BookIcon, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                      { label: t.stats.totalChapters, value: allChapters.length, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
                      { label: t.stats.dueReviews, value: dueReviews.length, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                      { label: language === 'ar' ? 'معدل الإنجاز' : 'Completion', value: retentionRate, icon: TrendingUp, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                    ].map((stat, i) => (
                      <StatsCard key={i} {...stat} index={i} />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="glass border-white/5">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          {language === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {allChapters.length === 0 ? (
                          <p className="text-center text-muted-foreground py-6 text-sm">
                            {language === 'ar' ? 'لا يوجد نشاط بعد' : 'No activity yet'}
                          </p>
                        ) : allChapters.slice(0, 5).map((chapter, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <BookOpen className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <p className="text-xs font-medium text-white truncate max-w-[160px]">{chapter.title}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(chapter.createdAt.toDate(), 'd MMM', { locale: language === 'ar' ? ar : undefined })}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="glass border-white/5">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Award className="w-4 h-4 text-primary" />
                          {language === 'ar' ? 'الإنجازات' : 'Achievements'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3">
                        {[
                          { title: language === 'ar' ? 'قارئ مبتدئ' : 'First Book', desc: language === 'ar' ? 'أضف أول كتاب' : 'Add your first book', achieved: books.length >= 1 },
                          { title: language === 'ar' ? 'مخطط بارع' : 'Map Maker', desc: language === 'ar' ? 'أنشئ 5 خرائط' : 'Create 5 mind maps', achieved: allChapters.length >= 5 },
                          { title: language === 'ar' ? 'مكتبة متكاملة' : 'Full Library', desc: language === 'ar' ? 'أضف 3 كتب' : 'Add 3 books', achieved: books.length >= 3 },
                          { title: language === 'ar' ? 'مثابر' : 'Persistent', desc: language === 'ar' ? '10 فصول ملخصة' : '10 chapters summarized', achieved: allChapters.length >= 10 },
                        ].map((badge, i) => (
                          <div key={i} className={cn(
                            "p-3 rounded-xl border flex flex-col items-center text-center gap-2 transition-all",
                            badge.achieved
                              ? "bg-primary/8 border-primary/20"
                              : "bg-white/3 border-white/5 opacity-40 grayscale"
                          )}>
                            <Award className={cn("w-6 h-6", badge.achieved ? "text-primary" : "text-muted-foreground")} />
                            <div>
                              <p className="text-xs font-bold text-white">{badge.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{badge.desc}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}

              {/* ---- DASHBOARD ---- */}
              {view === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="space-y-10"
                >
                  <div className="space-y-1 pt-2">
                    <span className="text-xs font-bold uppercase tracking-[0.4em] text-primary/70">
                      {language === 'ar' ? 'نظرة عامة' : 'Overview'}
                    </span>
                    <h2 className="text-4xl font-bold text-white leading-tight">
                      {language === 'ar' ? 'مكتبتك الرقمية' : 'Your Digital Library'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: t.stats.totalBooks, value: books.length, icon: BookIcon, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                      { label: t.stats.totalChapters, value: allChapters.length, icon: Brain, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                      { label: t.stats.dueReviews, value: dueReviews.length, icon: Calendar, color: 'text-green-400', bg: 'bg-green-400/10' },
                    ].map((stat, i) => (
                      <StatsCard key={i} {...stat} index={i} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      {t.library}
                    </h3>
                    <Button
                      onClick={() => setIsAddingBook(true)}
                      className="h-9 px-5 rounded-xl font-bold shadow-lg shadow-primary/20 group"
                    >
                      <Plus className={cn("w-4 h-4 transition-transform group-hover:rotate-90", language === 'ar' ? "ml-2" : "mr-2")} />
                      {t.addBook}
                    </Button>
                  </div>

                  {isAddingBook && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="glass border-primary/20 overflow-hidden">
                        <form onSubmit={addBook}>
                          <CardHeader className="bg-primary/5 border-b border-primary/10 py-4 px-6">
                            <CardTitle className="text-sm">{t.addBook}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                  {language === 'ar' ? 'عنوان الكتاب *' : 'Book Title *'}
                                </Label>
                                <Input name="title" required className="bg-white/5 border-border h-10" placeholder={language === 'ar' ? 'أدخل العنوان...' : 'Enter title...'} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.bookDetail.author}</Label>
                                <Input name="author" className="bg-white/5 border-border h-10" placeholder={language === 'ar' ? 'اسم المؤلف...' : 'Author name...'} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                  {language === 'ar' ? 'عدد الفصول *' : 'Total Chapters *'}
                                </Label>
                                <Input name="totalChapters" type="number" min="1" required className="bg-white/5 border-border h-10" placeholder="12" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                  {language === 'ar' ? 'صورة الغلاف' : 'Cover Image'}
                                </Label>
                                <div className="flex gap-3 items-center">
                                  <Input type="file" accept="image/*" onChange={handleFileChange} className="bg-white/5 border-border h-10 pt-2 text-xs" />
                                  {coverBase64 && (
                                    <img src={coverBase64} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter className="px-6 pb-6 pt-0 gap-3">
                            <Button type="submit" disabled={isSubmitting} className="flex-1 h-10">
                              {isSubmitting ? '...' : t.common.save}
                            </Button>
                            <Button type="button" variant="ghost" className="flex-1 h-10" onClick={() => { setIsAddingBook(false); setCoverBase64(''); }}>
                              {t.common.cancel}
                            </Button>
                          </CardFooter>
                        </form>
                      </Card>
                    </motion.div>
                  )}

                  {books.length === 0 && !isAddingBook && (
                    <EmptyState
                      icon={BookIcon}
                      title={language === 'ar' ? 'مكتبتك فارغة' : 'Your library is empty'}
                      description={language === 'ar' ? 'ابدأ بإضافة كتاب لبناء مكتبتك الرقمية وتلخيص محتواه في خرائط ذهنية.' : 'Start by adding a book to build your digital library and summarize it with mind maps.'}
                      actionLabel={t.addBook}
                      onAction={() => setIsAddingBook(true)}
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {books.map((book, index) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        chapters={allChapters.filter(c => c.bookId === book.id)}
                        index={index}
                        language={language}
                        onClick={() => { setSelectedBook(book); setView('book-detail'); }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ---- BOOK DETAIL ---- */}
              {view === 'book-detail' && selectedBook && (
                <motion.div
                  key="book-detail"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="space-y-8"
                >
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <button className="hover:text-primary transition-colors" onClick={() => setView('dashboard')}>
                      {t.library}
                    </button>
                    <ChevronRight className={cn("w-3 h-3 opacity-40", language === 'en' && "rotate-180")} />
                    <span className="text-white">{selectedBook.title}</span>
                  </div>

                  {/* Book Header */}
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-full md:w-52 shrink-0">
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden glass border border-white/8 shadow-2xl relative group">
                        {selectedBook.coverUrl ? (
                          <img src={selectedBook.coverUrl} alt={selectedBook.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-orange-500/5 flex items-center justify-center">
                            <BookIcon className="w-16 h-16 text-primary/15" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-5 w-full">
                      <div>
                        <h2 className="text-4xl font-bold text-white leading-tight">{selectedBook.title}</h2>
                        {selectedBook.author && (
                          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                            <UserIcon className="w-3.5 h-3.5" />
                            {selectedBook.author}
                          </p>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="glass p-4 rounded-xl border-white/5 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-muted-foreground">{t.bookDetail.progress}</span>
                          <span className="font-bold text-primary">
                            {chapters.length} / {selectedBook.totalChapters} ({Math.round((chapters.length / selectedBook.totalChapters) * 100)}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(chapters.length / selectedBook.totalChapters) * 100}%` }}
                            className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Tooltip content={t.bookDetail.editBook} position="top">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 border-white/10 hover:bg-white/10 rounded-xl"
                            onClick={() => { setIsEditingBook(selectedBook); setCoverBase64(selectedBook.coverUrl || ''); }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={t.bookDetail.deleteBook} position="top">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 border-destructive/10 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                            onClick={() => setIsDeletingBook(selectedBook.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <div className="w-px h-6 bg-white/10 self-center mx-1" />
                        <Button
                          size="sm"
                          className="h-9 px-5 rounded-xl font-bold shadow-lg shadow-primary/20"
                          onClick={() => setIsAddingChapter(true)}
                        >
                          <Plus className={cn("w-4 h-4", language === 'ar' ? "ml-1.5" : "mr-1.5")} />
                          {t.bookDetail.addChapter}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Add Chapter Form */}
                  {isAddingChapter && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="glass border-primary/20 overflow-hidden">
                        <form onSubmit={addChapter}>
                          <CardHeader className="bg-primary/5 border-b border-primary/10 py-4 px-6">
                            <CardTitle className="text-sm">{t.bookDetail.addChapter}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-6">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {language === 'ar' ? 'عنوان الفصل *' : 'Chapter Title *'}
                              </Label>
                              <Input name="title" required autoFocus className="bg-white/5 border-border h-10" placeholder={language === 'ar' ? 'مثال: مقدمة في الموضوع...' : 'e.g., Chapter 1: Introduction...'} />
                            </div>
                          </CardContent>
                          <CardFooter className="px-6 pb-6 pt-0 gap-3">
                            <Button type="submit" disabled={isSubmitting} className="flex-1 h-10">
                              {isSubmitting ? '...' : t.bookDetail.addChapter}
                            </Button>
                            <Button type="button" variant="ghost" className="flex-1 h-10" onClick={() => setIsAddingChapter(false)}>
                              {t.common.cancel}
                            </Button>
                          </CardFooter>
                        </form>
                      </Card>
                    </motion.div>
                  )}

                  {/* Edit Chapter Form */}
                  {isEditingChapter && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="glass border-primary/20 overflow-hidden">
                        <form onSubmit={updateChapter}>
                          <CardHeader className="bg-primary/5 border-b border-primary/10 py-4 px-6">
                            <CardTitle className="text-sm">{t.chapter.editTitle}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-6">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {language === 'ar' ? 'عنوان الفصل' : 'Chapter Title'}
                              </Label>
                              <Input name="title" defaultValue={isEditingChapter.title} required autoFocus className="bg-white/5 border-border h-10" />
                            </div>
                          </CardContent>
                          <CardFooter className="px-6 pb-6 pt-0 gap-3">
                            <Button type="submit" disabled={isSubmitting} className="flex-1 h-10">
                              {isSubmitting ? '...' : language === 'ar' ? 'تحديث' : 'Update'}
                            </Button>
                            <Button type="button" variant="ghost" className="flex-1 h-10" onClick={() => setIsEditingChapter(null)}>
                              {t.common.cancel}
                            </Button>
                          </CardFooter>
                        </form>
                      </Card>
                    </motion.div>
                  )}

                  {/* Chapters List */}
                  {chapters.length === 0 && !isAddingChapter && (
                    <EmptyState
                      icon={BookOpen}
                      title={language === 'ar' ? 'لا توجد فصول بعد' : 'No chapters yet'}
                      description={language === 'ar' ? 'أضف فصلاً لبدء إنشاء خريطة ذهنية لهذا الكتاب.' : 'Add a chapter to start creating mind maps for this book.'}
                      actionLabel={t.bookDetail.addChapter}
                      onAction={() => setIsAddingChapter(true)}
                    />
                  )}

                  <div className="space-y-3">
                    {chapters.map((chapter, index) => (
                      <ChapterCard
                        key={chapter.id}
                        chapter={chapter}
                        review={reviews.find(r => r.chapterId === chapter.id)}
                        index={index}
                        language={language}
                        t={t}
                        onEdit={() => setIsEditingChapter(chapter)}
                        onDelete={() => setIsDeletingChapter(chapter.id)}
                        onOpenEditor={() => { setSelectedChapter(chapter); setView('editor'); }}
                        onStartReview={() => { setSelectedChapter(chapter); setView('review'); }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ---- EDITOR ---- */}
              {view === 'editor' && selectedChapter && (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-background flex flex-col"
                >
                  <div className="atmosphere" />
                  <div className="absolute top-5 left-5 right-5 z-40 flex justify-between items-center pointer-events-none">
                    <div className="pointer-events-auto glass-dark border border-white/8 rounded-xl px-4 py-2">
                      <p className="text-xs font-bold text-primary truncate max-w-[200px]">{selectedChapter.title}</p>
                    </div>
                    <div className="flex gap-2 pointer-events-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 rounded-xl glass border-primary/20 text-primary hover:bg-primary/10"
                        onClick={() => {
                          saveMindMap(JSON.parse(selectedChapter.mindMap), true);
                          toast.info(language === 'ar' ? 'استخدم زر "حفظ الخريطة" داخل المحرر' : 'Use "Save Map" inside the editor');
                        }}
                      >
                        <Save className={cn("w-3.5 h-3.5", language === 'ar' ? "ml-1.5" : "mr-1.5")} />
                        {t.editor.save}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-4 rounded-xl glass border-white/8 hover:bg-white/10"
                        onClick={() => setView('book-detail')}
                      >
                        {t.editor.close}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 w-full h-full">
                    <MindMapEditor
                      initialData={JSON.parse(selectedChapter.mindMap)}
                      onSave={saveMindMap}
                    />
                  </div>
                </motion.div>
              )}

              {/* ---- REVIEW ---- */}
              {view === 'review' && selectedChapter && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-background overflow-y-auto"
                >
                  <div className="atmosphere" />
                  <div className="container max-w-6xl mx-auto px-6 py-8 min-h-screen flex flex-col">
                    <ReviewMode
                      chapterTitle={selectedChapter.title}
                      originalMindMap={JSON.parse(selectedChapter.mindMap)}
                      onComplete={completeReview}
                      onCancel={() => setView('book-detail')}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <Toaster position="top-center" />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {(isDeletingBook || isDeletingChapter) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => { setIsDeletingBook(null); setIsDeletingChapter(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-sm glass border-destructive/20 rounded-2xl overflow-hidden"
            >
              <div className="p-7 space-y-5 text-center">
                <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto border border-destructive/15">
                  <AlertTriangle className="w-7 h-7 text-destructive" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-white">{t.common.confirmDelete}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {isDeletingBook
                      ? language === 'ar' ? 'سيتم حذف الكتاب وجميع فصوله نهائياً.' : 'The book and all its chapters will be permanently deleted.'
                      : language === 'ar' ? 'سيتم حذف هذا الفصل وخريطته الذهنية نهائياً.' : 'This chapter and its mind map will be permanently deleted.'}
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <Button
                    variant="destructive"
                    className="flex-1 h-10 font-bold"
                    onClick={() => {
                      if (isDeletingBook) deleteBook(isDeletingBook);
                      else if (isDeletingChapter) deleteChapter(isDeletingChapter);
                    }}
                  >
                    {t.common.yesDelete}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 h-10 hover:bg-white/10"
                    onClick={() => { setIsDeletingBook(null); setIsDeletingChapter(null); }}
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Book Dialog */}
      <AnimatePresence>
        {isEditingBook && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => { setIsEditingBook(null); setCoverBase64(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-lg glass border-white/10 rounded-2xl overflow-hidden"
            >
              <form onSubmit={updateBook}>
                <CardHeader className="bg-primary/5 border-b border-primary/10 py-5 px-6">
                  <CardTitle className="text-base">{t.bookDetail.editBook}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'العنوان' : 'Title'}</Label>
                      <Input name="title" defaultValue={isEditingBook.title} required className="bg-white/5 border-border h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.bookDetail.author}</Label>
                      <Input name="author" defaultValue={isEditingBook.author} className="bg-white/5 border-border h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'عدد الفصول' : 'Total Chapters'}</Label>
                      <Input name="totalChapters" type="number" defaultValue={isEditingBook.totalChapters} required min="1" className="bg-white/5 border-border h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'تغيير الغلاف' : 'Change Cover'}</Label>
                      <div className="flex gap-3 items-center">
                        <Input type="file" accept="image/*" onChange={handleFileChange} className="bg-white/5 border-border h-10 pt-2 text-xs" />
                        {coverBase64 && (
                          <img src={coverBase64} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="px-6 pb-6 pt-0 gap-3">
                  <Button type="submit" disabled={isSubmitting} className="flex-1 h-10">
                    {isSubmitting ? '...' : language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                  </Button>
                  <Button type="button" variant="ghost" className="flex-1 h-10" onClick={() => { setIsEditingBook(null); setCoverBase64(''); }}>
                    {t.common.cancel}
                  </Button>
                </CardFooter>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
