/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Plus, 
  LogOut, 
  Brain, 
  Calendar, 
  ChevronRight, 
  Book as BookIcon,
  Clock,
  CheckCircle2,
  Edit,
  Trash2,
  AlertTriangle,
  User as UserIcon,
  TrendingUp,
  Award,
  Zap,
  ArrowRight,
  Sparkles,
  LayoutDashboard
} from 'lucide-react';
import { MindMapEditor } from './components/MindMapEditor';
import { ReviewMode } from './components/ReviewMode';
import { format, isBefore, startOfDay, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip } from './components/Tooltip';
import { Info, HelpCircle, ChevronDown, ChevronUp, ExternalLink, Menu, Save } from 'lucide-react';

import { translations, Language } from './translations';
import { Languages } from 'lucide-react';

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
  const [isBookInfoExpanded, setIsBookInfoExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners
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
      console.error('Login Error:', err);
      if (err.code === 'auth/popup-blocked') {
        toast.error('تم حظر النافذة المنبثقة. يرجى السماح بالمنبثقات لهذا الموقع.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.warn('Popup request cancelled');
      } else if (err.code === 'auth/popup-closed-by-user') {
        toast.error('تم إغلاق نافذة تسجيل الدخول');
      } else {
        toast.error('فشل تسجيل الدخول: ' + (err.message || 'خطأ غير معروف'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const addBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const totalChapters = parseInt(formData.get('totalChapters') as string) || 1;

    try {
      const bookData: any = {
        title,
        author: author || "",
        totalChapters,
        userId: user.uid,
        createdAt: Timestamp.now(),
      };
      
      if (coverBase64) {
        bookData.coverUrl = coverBase64;
      }

      await addDoc(collection(db, 'books'), bookData);
      setIsAddingBook(false);
      setCoverBase64('');
      toast.success('تمت إضافة الكتاب بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'books');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit
        toast.error('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 500 كيلوبايت.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addChapter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedBook) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;

    try {
      const chapterRef = await addDoc(collection(db, 'chapters'), {
        bookId: selectedBook.id,
        title,
        mindMap: JSON.stringify({ nodes: [{ id: 'root', type: 'input', data: { label: title }, position: { x: 250, y: 5 } }], edges: [] }),
        userId: user.uid,
        createdAt: Timestamp.now(),
      });

      // Initialize review - Start from next day
      await setDoc(doc(db, 'reviews', chapterRef.id), {
        chapterId: chapterRef.id,
        userId: user.uid,
        nextReviewDate: Timestamp.fromDate(addDays(startOfDay(new Date()), 1)),
        interval: 0,
        easeFactor: 2.5,
        status: 'new'
      });

      setIsAddingChapter(false);
      toast.success('تمت إضافة الفصل بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chapters');
    }
  };

  const deleteBook = async (bookId: string) => {
    try {
      // 1. Delete associated reviews and chapters
      const bookChapters = allChapters.filter(c => c.bookId === bookId);
      for (const chapter of bookChapters) {
        await deleteDoc(doc(db, 'reviews', chapter.id));
        await deleteDoc(doc(db, 'chapters', chapter.id));
      }
      
      // 2. Delete the book
      await deleteDoc(doc(db, 'books', bookId));
      
      setIsDeletingBook(null);
      setSelectedBook(null);
      setView('dashboard');
      toast.success('تم حذف الكتاب وجميع فصوله بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `books/${bookId}`);
    }
  };

  const updateBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !isEditingBook) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const totalChapters = parseInt(formData.get('totalChapters') as string) || 1;

    try {
      const updateData: any = {
        title,
        author: author || "",
        totalChapters,
      };
      
      if (coverBase64) {
        updateData.coverUrl = coverBase64;
      }

      await updateDoc(doc(db, 'books', isEditingBook.id), updateData);
      
      // Update local state if it's the selected book
      if (selectedBook?.id === isEditingBook.id) {
        setSelectedBook({ ...selectedBook, ...updateData });
      }
      
      setIsEditingBook(null);
      setCoverBase64('');
      toast.success('تم تحديث بيانات الكتاب بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `books/${isEditingBook.id}`);
    }
  };

  const deleteChapter = async (chapterId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', chapterId));
      await deleteDoc(doc(db, 'chapters', chapterId));
      setIsDeletingChapter(null);
      toast.success('تم حذف الفصل بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chapters/${chapterId}`);
    }
  };

  const updateChapter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !isEditingChapter) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;

    try {
      await updateDoc(doc(db, 'chapters', isEditingChapter.id), { title });
      setIsEditingChapter(null);
      toast.success('تم تحديث عنوان الفصل بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chapters/${isEditingChapter.id}`);
    }
  };
  const saveMindMap = async (data: any, silent = false) => {
    if (!selectedChapter) return;
    try {
      await updateDoc(doc(db, 'chapters', selectedChapter.id), {
        mindMap: JSON.stringify(data)
      });
      
      // If it's the first time saving (status is 'new'), schedule for 2 days later
      const review = reviews.find(r => r.chapterId === selectedChapter.id);
      if (review && review.status === 'new') {
        await updateDoc(doc(db, 'reviews', review.id), {
          nextReviewDate: Timestamp.fromDate(addDays(startOfDay(new Date()), 2)),
          status: 'learning'
        });
      }

      if (!silent) {
        toast.success('تم حفظ الخريطة الذهنية وجدولة المراجعة');
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
      toast.success('تم تحديث موعد المراجعة القادم');
      setView('book-detail');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
    }
  };

  const dueReviews = useMemo(() => {
    const today = startOfDay(new Date());
    return reviews.filter(r => isBefore(r.nextReviewDate.toDate(), today) || r.status === 'new');
  }, [reviews]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-slate-500 font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background font-sans text-foreground overflow-hidden selection:bg-primary/30" dir="rtl">
        <div className="atmosphere" />
        
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 glass border-b border-white/5">
          <div className="container max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(242,125,38,0.3)]">
                <Brain className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-bold tracking-wider text-primary">MindShelf</span>
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              className="bg-white text-black hover:bg-white/90 rounded-full px-8 h-11 font-bold shadow-xl shadow-white/10"
            >
              {isLoggingIn ? 'جاري التحميل...' : 'ابدأ الآن مجاناً'}
            </Button>
          </div>
        </nav>

        <main className="relative pt-32 pb-20">
          {/* Hero Section */}
          <section className="container max-w-7xl mx-auto px-6 text-center space-y-12 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/30 text-primary bg-primary/5 text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3 ml-2" />
                مستقبلك الدراسي يبدأ هنا
              </Badge>
              <h1 className="text-6xl md:text-8xl font-black text-white leading-[1.1] tracking-tight">
                حوّل كتبك إلى <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-primary animate-gradient">خرائط ذهنية</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                MindShelf هو رفيقك الذكي لتنظيم المعرفة، يجمع بين قوة الخرائط الذهنية وتقنيات التكرار المتباعد لضمان حفظ المعلومات للأبد.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-col md:flex-row gap-4 justify-center items-center"
            >
              <Button 
                size="lg" 
                onClick={handleLogin}
                className="h-14 px-10 text-lg font-bold bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 rounded-2xl group"
              >
                ابدأ رحلة التعلم
                <ArrowRight className="mr-2 w-5 h-5 transition-transform group-hover:-translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-14 px-10 text-lg font-bold glass border-white/10 hover:bg-white/5 rounded-2xl"
              >
                شاهد كيف يعمل
              </Button>
            </motion.div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-20">
              {[
                {
                  title: "خرائط ذهنية تفاعلية",
                  desc: "صمم أفكارك بصرياً واربط بين المفاهيم المعقدة بسهولة تامة.",
                  icon: Brain,
                  color: "text-orange-500",
                  bg: "bg-orange-500/10"
                },
                {
                  title: "التكرار المتباعد (SRS)",
                  desc: "خوارزمية ذكية تذكرك بمراجعة المعلومات في الوقت المثالي قبل نسيانها.",
                  icon: Zap,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10"
                },
                {
                  title: "إحصائيات التقدم",
                  desc: "تابع تطورك الدراسي وشاهد مكتبتك الرقمية تنمو يوماً بعد يوم.",
                  icon: TrendingUp,
                  color: "text-green-500",
                  bg: "bg-green-500/10"
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + (i * 0.1) }}
                >
                  <Card className="glass border-white/5 hover:border-primary/20 transition-all p-8 text-right group h-full">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", feature.bg)}>
                      <feature.icon className={cn("w-8 h-8", feature.color)} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Decorative Elements */}
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="atmosphere" />
      
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          "h-full glass-dark flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden",
          sidebarCollapsed ? "w-0 border-none" : "w-[280px] border-r border-white/5"
        )}>
          <div className="w-[280px] h-full flex flex-col">
            <div className="p-8">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(242,125,38,0.3)] shrink-0">
                    <Brain className="w-6 h-6 text-black" />
                  </div>
                  <h1 className="text-xl font-bold tracking-wider text-primary truncate">{t.appName.split(' - ')[0]}</h1>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg hover:bg-white/10 text-muted-foreground"
                    onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                    title={language === 'ar' ? 'Switch to English' : 'تغيير للغة العربية'}
                  >
                    <Languages className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg hover:bg-white/10 text-muted-foreground"
                    onClick={() => setSidebarCollapsed(true)}
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* User Profile Section */}
              <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                <div className="relative">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-12 h-12 rounded-xl object-cover border border-primary/20" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <UserIcon className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#0a0a0a] rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user?.displayName || (language === 'ar' ? 'المستخدم' : 'User')}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10 h-11 px-4 rounded-xl transition-all",
                    view === 'dashboard' && "bg-primary/10 text-primary"
                  )} 
                  onClick={() => setView('dashboard')}
                >
                  <LayoutDashboard className={cn("w-4 h-4", language === 'ar' ? "ml-3" : "mr-3")} />
                  <span>{t.dashboard}</span>
                </Button>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10 h-11 px-4 rounded-xl transition-all",
                    view === 'profile' && "bg-primary/10 text-primary"
                  )} 
                  onClick={() => setView('profile')}
                >
                  <UserIcon className={cn("w-4 h-4", language === 'ar' ? "ml-3" : "mr-3")} />
                  <span>{language === 'ar' ? 'الملف الشخصي' : 'Profile'}</span>
                </Button>
              </div>

              <div className="pt-6">
                {/* Book list removed as requested */}
              </div>
            </div>
          </div>

          <div className="mt-auto p-8 border-t border-border bg-black/20 text-center">
            <Button 
              variant="ghost" 
              className="w-full justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-12 rounded-2xl"
              onClick={handleLogout}
            >
              <LogOut className={cn("w-4 h-4", language === 'ar' ? "ml-2" : "mr-2")} />
              <span>{t.logout}</span>
            </Button>
          </div>
        </div>
      </aside>

        {/* Main Content */}
        <main className={cn(
          "flex-1 h-full relative z-10 custom-scrollbar",
          view === 'editor' ? "overflow-hidden" : "overflow-y-auto"
        )}>
          {/* Sidebar Toggle Button */}
          <div className={cn(
            "fixed top-6 z-40 transition-all duration-300",
            language === 'ar' ? "right-6" : "left-6",
            !sidebarCollapsed && (language === 'ar' ? "right-[304px]" : "left-[304px]"),
            view === 'editor' && "opacity-0 pointer-events-none" // Hide toggle in editor for more space
          )}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-12 w-12 rounded-2xl glass-dark border border-white/10 shadow-2xl text-primary hover:scale-110 transition-all"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>

          <div className={cn(
            "mx-auto transition-all duration-300 h-full",
            view === 'editor' ? "w-full max-w-none p-0" : "container max-w-6xl px-8 py-12"
          )}>
            <AnimatePresence mode="wait">
              {view === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-12"
                >
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-3xl overflow-hidden glass border-2 border-primary/30 p-1">
                        <img 
                          src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                          alt="Profile" 
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-background">
                        <Award className="w-5 h-5 text-black" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-bold text-white">{user?.displayName}</h2>
                      <p className="text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        {language === 'ar' ? 'عضو نشط منذ ' : 'Active member since '} {user?.metadata.creationTime ? format(new Date(user.metadata.creationTime), 'MMMM yyyy', { locale: language === 'ar' ? ar : undefined }) : '...'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: t.stats.totalBooks, value: books.length, icon: BookIcon, color: 'text-blue-400', bg: 'bg-blue-500/10', help: language === 'ar' ? 'عدد الكتب التي أضفتها لمكتبتك الرقمية' : 'Number of books added to your digital library' },
                      { label: t.stats.totalChapters, value: allChapters.length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', help: language === 'ar' ? 'إجمالي الفصول التي قمت بتلخيصها في خرائط ذهنية' : 'Total chapters summarized into mind maps' },
                      { label: t.stats.dueReviews, value: dueReviews.length, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10', help: language === 'ar' ? 'عدد الفصول التي حان موعد مراجعتها بناءً على خوارزمية التكرار المتباعد' : 'Number of chapters due for review based on spaced repetition' },
                      { label: language === 'ar' ? 'معدل الحفظ' : 'Retention Rate', value: `${Math.round((allChapters.length / (books.reduce((acc, b) => acc + b.totalChapters, 0) || 1)) * 100)}%`, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10', help: language === 'ar' ? 'نسبة الفصول المنجزة مقارنة بإجمالي فصول الكتب في مكتبتك' : 'Percentage of completed chapters compared to total book chapters' },
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className="glass border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden card-glow">
                          <div className="absolute top-2 left-2">
                            <Tooltip content={stat.help} position="top">
                              <HelpCircle className="w-3 h-3 text-muted-foreground/40 hover:text-primary transition-colors cursor-help" />
                            </Tooltip>
                          </div>
                          <CardContent className="p-8">
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3", stat.bg)}>
                              <stat.icon className={cn("w-7 h-7", stat.color)} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
                              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{stat.label}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="glass border-white/5">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className="w-5 h-5 text-primary" />
                          {language === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {allChapters.slice(0, 5).map((chapter, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{chapter.title}</p>
                                <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'تمت إضافة فصل جديد' : 'New chapter added'}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {format(chapter.createdAt.toDate(), 'dd MMM', { locale: language === 'ar' ? ar : undefined })}
                            </span>
                          </div>
                        ))}
                        {allChapters.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">{language === 'ar' ? 'لا يوجد نشاط مسجل بعد' : 'No activity recorded yet'}</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="glass border-white/5 overflow-hidden">
                      <CardHeader className="bg-white/5 border-b border-white/10">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Info className="w-5 h-5 text-primary" />
                          {language === 'ar' ? 'معلومات الموقع' : 'Site Information'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                          <p className="text-muted-foreground leading-relaxed text-sm">
                            {language === 'ar' 
                              ? 'هذا الموقع يتكون من 4 صفحات (أقسام) رئيسية مصممة لتجربة تعليمية متكاملة:' 
                              : 'This site consists of 4 main pages (sections) designed for an integrated learning experience:'}
                          </p>
                          <ul className="space-y-3">
                            {[
                              { title: language === 'ar' ? 'لوحة التحكم (المكتبة)' : 'Dashboard (Library)', desc: language === 'ar' ? 'لعرض وإدارة جميع كتبك وإحصائياتك السريعة.' : 'To view and manage all your books and quick stats.' },
                              { title: language === 'ar' ? 'تفاصيل الكتاب' : 'Book Details', desc: language === 'ar' ? 'لعرض فصول الكتاب، تتبع التقدم، والوصول للروابط المفيدة.' : 'To view book chapters, track progress, and access useful links.' },
                              { title: language === 'ar' ? 'محرر الخرائط الذهنية' : 'Mind Map Editor', desc: language === 'ar' ? 'المساحة الإبداعية لتلخيص الفصول وتحويلها لخرائط بصرية.' : 'The creative space to summarize chapters and turn them into visual maps.' },
                              { title: language === 'ar' ? 'وضع المراجعة' : 'Review Mode', desc: language === 'ar' ? 'نظام ذكي للمراجعة يعتمد على التكرار المتباعد لضمان الحفظ.' : 'A smart review system based on spaced repetition to ensure retention.' },
                            ].map((page, i) => (
                              <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">
                                  {i + 1}
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white">{page.title}</h4>
                                  <p className="text-[10px] text-muted-foreground mt-1">{page.desc}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                    <Card className="glass border-white/5">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Award className="w-5 h-5 text-primary" />
                          الإنجازات
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        {[
                          { title: 'قارئ مبتدئ', desc: 'أضف أول كتاب لك', achieved: books.length >= 1 },
                          { title: 'مخطط بارع', desc: 'أنشئ 5 خرائط ذهنية', achieved: allChapters.length >= 5 },
                          { title: 'ذاكرة حديدية', desc: 'أكمل 10 مراجعات', achieved: reviews.filter(r => r.status === 'reviewing').length >= 10 },
                          { title: 'مكتبة متكاملة', desc: 'أضف 3 كتب لمجموعتك', achieved: books.length >= 3 },
                        ].map((badge, i) => (
                          <div key={i} className={cn(
                            "p-4 rounded-2xl border transition-all flex flex-col items-center text-center gap-2",
                            badge.achieved ? "bg-primary/10 border-primary/30" : "bg-white/5 border-white/5 opacity-40 grayscale"
                          )}>
                            <Award className={cn("w-8 h-8", badge.achieved ? "text-primary" : "text-muted-foreground")} />
                            <div>
                              <p className="text-xs font-bold">{badge.title}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">{badge.desc}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
              )}

              {view === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-12"
                >
                  <div className="space-y-6 text-center py-12">
                    <motion.span 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-bold uppercase tracking-[0.5em] text-primary/80"
                    >
                      {language === 'ar' ? 'نظرة عامة' : 'Overview'}
                    </motion.span>
                    <motion.h2 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-6xl font-bold tracking-tight text-white leading-tight"
                    >
                      {language === 'ar' ? 'مرحباً بك في' : 'Welcome to'} <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-300">
                        {language === 'ar' ? 'مكتبتك الرقمية' : 'Your Digital Library'}
                      </span>
                    </motion.h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { label: t.stats.totalBooks, value: books.length, icon: BookIcon, color: "text-blue-400", bg: "bg-blue-400/10" },
                      { label: t.stats.totalChapters, value: allChapters.length, icon: Brain, color: "text-orange-400", bg: "bg-orange-400/10" },
                      { label: t.stats.dueReviews, value: dueReviews.length, icon: Calendar, color: "text-green-400", bg: "bg-green-400/10" },
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + (i * 0.1) }}
                      >
                        <Card className="glass border-white/5 p-6 flex items-center gap-6 group hover:border-primary/20 transition-all">
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg)}>
                            <stat.icon className={cn("w-7 h-7", stat.color)} />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                            <p className="text-3xl font-bold text-white">{stat.value}</p>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-primary" />
                      {t.library}
                    </h3>
                    <Button 
                      size="lg" 
                      className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-black font-bold text-sm shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 group"
                      onClick={() => setIsAddingBook(true)}
                    >
                      <Plus className={cn("w-5 h-5 transition-transform group-hover:rotate-90", language === 'ar' ? "ml-3" : "mr-3")} />
                      {t.addBook}
                    </Button>
                  </div>

                  {isAddingBook && (
                    <Card className="glass border-primary/20 overflow-hidden">
                      <form onSubmit={addBook}>
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                          <CardTitle className="text-lg">{t.addBook}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="title" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'عنوان الكتاب' : 'Book Title'}</Label>
                              <Input id="title" name="title" required className="bg-white/5 border-border focus:border-primary/50 h-12" placeholder={language === 'ar' ? "أدخل عنوان الكتاب..." : "Enter book title..."} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="author" className="text-xs uppercase tracking-widest text-muted-foreground">{t.bookDetail.author}</Label>
                              <Input id="author" name="author" className="bg-white/5 border-border focus:border-primary/50 h-12" placeholder={language === 'ar' ? "أدخل اسم المؤلف..." : "Enter author name..."} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="totalChapters" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'عدد الفصول الإجمالي' : 'Total Chapters'}</Label>
                              <Input id="totalChapters" name="totalChapters" type="number" min="1" required className="bg-white/5 border-border focus:border-primary/50 h-12" placeholder="12" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="coverFile" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'غلاف الكتاب (صورة)' : 'Book Cover (Image)'}</Label>
                              <div className="flex gap-4 items-center">
                                <Input 
                                  id="coverFile" 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleFileChange}
                                  className="bg-white/5 border-border focus:border-primary/50 h-12 pt-2" 
                                />
                                {coverBase64 && (
                                  <div className="w-12 h-12 rounded-lg overflow-hidden glass border-white/10 shrink-0">
                                    <img src={coverBase64} alt="Preview" className="w-full h-full object-cover" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-8 pt-0 gap-3">
                          <Button type="submit" className="flex-1 h-12 shadow-lg shadow-primary/20 shimmer font-bold">{t.common.save}</Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="flex-1 h-12 font-bold" 
                            onClick={() => {
                              setIsAddingBook(false);
                              setCoverBase64('');
                            }}
                          >
                            {t.common.cancel}
                          </Button>
                        </CardFooter>
                      </form>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {books.map((book, index) => {
                      const bookChapters = allChapters.filter(c => c.bookId === book.id);
                      const progress = Math.min(100, (bookChapters.length / book.totalChapters) * 100);
                      
                      return (
                        <motion.div
                          key={book.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card 
                            className="group hover:scale-[1.02] transition-all cursor-pointer glass border-transparent hover:border-primary/30 overflow-hidden flex flex-col card-glow"
                            onClick={() => {
                              setSelectedBook(book);
                              setView('book-detail');
                            }}
                          >
                            <div className="relative h-56 overflow-hidden">
                              {book.coverUrl ? (
                                <img 
                                  src={book.coverUrl} 
                                  alt={book.title} 
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary/5 flex items-center justify-center">
                                  <BookIcon className="w-16 h-16 text-primary/10" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-90" />
                              <div className="absolute bottom-6 right-6 left-6">
                                 <div className="flex justify-between items-end mb-3">
                                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">{language === 'ar' ? 'نسبة الإنجاز' : 'Completion Rate'}</span>
                                   <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
                                 </div>
                                 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
                                   <motion.div 
                                     initial={{ width: 0 }}
                                     animate={{ width: `${progress}%` }}
                                     transition={{ duration: 1.5, ease: "circOut" }}
                                     className="h-full bg-gradient-to-r from-primary via-orange-400 to-primary shadow-[0_0_20px_rgba(242,125,38,0.5)]" 
                                   />
                                 </div>
                              </div>
                            </div>
                            <CardHeader className="p-8 pb-4 flex-1">
                              <div className="flex justify-between items-start gap-4">
                                <CardTitle className="text-2xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">{book.title}</CardTitle>
                                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[10px] shrink-0">
                                  {progress === 100 ? (language === 'ar' ? 'مكتمل' : 'Completed') : (language === 'ar' ? 'قيد الدراسة' : 'Studying')}
                                </Badge>
                              </div>
                              <CardDescription className="text-muted-foreground text-sm mt-3 font-medium flex items-center gap-2">
                                <UserIcon className="w-3.5 h-3.5" />
                                {book.author || (language === 'ar' ? 'مؤلف غير معروف' : 'Unknown Author')}
                              </CardDescription>
                            </CardHeader>
                            <CardFooter className="px-8 pb-8 pt-4 flex items-center justify-between border-t border-white/5 mt-auto">
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-1">{t.bookDetail.chapters}</span>
                                  <span className="text-sm font-bold text-white">
                                    {bookChapters.length} / {book.totalChapters}
                                  </span>
                                </div>
                              </div>
                              <div className="w-12 h-12 rounded-2xl glass border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-all shadow-xl">
                                <ChevronRight className={cn("w-6 h-6 transition-transform", language === 'ar' ? "group-hover:translate-x-[-4px]" : "group-hover:translate-x-[4px] rotate-180")} />
                              </div>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {view === 'book-detail' && selectedBook && (
                <motion.div
                  key="book-detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => setView('dashboard')}>{t.library}</span>
                    <ChevronRight className={cn("w-3 h-3 opacity-30", language === 'en' && "rotate-180")} />
                    <span className="text-primary">{selectedBook.title}</span>
                  </div>

                  <div className="flex flex-col md:flex-row gap-12 items-start">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="w-full md:w-72 shrink-0"
                    >
                      <div className="aspect-[3/4] rounded-3xl overflow-hidden glass border-2 border-white/5 shadow-2xl relative group card-glow">
                        {selectedBook.coverUrl ? (
                          <img 
                            src={selectedBook.coverUrl} 
                            alt={selectedBook.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/5 flex items-center justify-center">
                            <BookIcon className="w-20 h-20 text-primary/10" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                           <Button variant="secondary" className="w-full h-10 rounded-xl font-bold text-xs" onClick={() => setIsEditingBook(selectedBook)}>{language === 'ar' ? 'تغيير الغلاف' : 'Change Cover'}</Button>
                        </div>
                      </div>
                    </motion.div>

                    <div className="flex-1 space-y-8 w-full">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          <h2 className="text-6xl font-bold tracking-tight text-white leading-tight">{selectedBook.title}</h2>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-primary" />
                            </div>
                            <p className="text-xl text-muted-foreground font-medium">{selectedBook.author}</p>
                          </div>
                        </motion.div>
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          id="book-actions-bar" 
                          className="flex gap-3 glass p-2.5 rounded-3xl border-white/10 shadow-2xl backdrop-blur-2xl"
                        >
                          <Tooltip content={t.bookDetail.editBook} position="top">
                            <Button 
                              id="edit-book-btn"
                              variant="ghost" 
                              onClick={() => {
                                setIsEditingBook(selectedBook);
                                setCoverBase64(selectedBook.coverUrl || '');
                              }} 
                              className="h-14 w-14 p-0 rounded-2xl hover:bg-white/10 text-muted-foreground hover:text-primary transition-all hover:scale-110 active:scale-95"
                            >
                              <Edit className="w-5 h-5" />
                            </Button>
                          </Tooltip>
                          <Tooltip content={t.bookDetail.deleteBook} position="top">
                            <Button 
                              id="delete-book-btn"
                              variant="ghost" 
                              onClick={() => setIsDeletingBook(selectedBook.id)} 
                              className="h-14 w-14 p-0 rounded-2xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all hover:scale-110 active:scale-95"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </Tooltip>
                          <div className="w-px h-8 bg-white/10 my-auto mx-1" />
                          <Tooltip content={t.bookDetail.addChapter} position="top">
                            <Button 
                              id="add-chapter-btn"
                              onClick={() => setIsAddingChapter(true)} 
                              className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            >
                              <Plus className={cn("w-5 h-5", language === 'ar' ? "ml-3" : "mr-3")} />
                              {t.bookDetail.addChapter}
                            </Button>
                          </Tooltip>
                        </motion.div>
                      </div>

                      <div className="glass p-6 rounded-2xl border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">تقدم القراءة</span>
                            <Tooltip content="توضح هذه النسبة مدى تقدمك في تلخيص فصول هذا الكتاب" position="top">
                              <HelpCircle className="w-3 h-3 text-muted-foreground/40 hover:text-primary cursor-help" />
                            </Tooltip>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {chapters.length} / {selectedBook.totalChapters} فصل ({Math.round((chapters.length / selectedBook.totalChapters) * 100)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(chapters.length / selectedBook.totalChapters) * 100}%` }}
                            className="h-full bg-primary" 
                          />
                        </div>
                      </div>

                      {/* Expandable Info Section removed */}
                    </div>
                  </div>

                  {isAddingChapter && (
                    <Card className="glass border-primary/20 overflow-hidden">
                      <form onSubmit={addChapter}>
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                          <CardTitle className="text-lg">{t.bookDetail.addChapter}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'عنوان الفصل' : 'Chapter Title'}</Label>
                            <Input id="title" name="title" required className="bg-white/5 border-border focus:border-primary/50 h-12" placeholder={language === 'ar' ? "مثال: الفصل الأول: العمران البشري..." : "Example: Chapter 1: Introduction..."} />
                          </div>
                        </CardContent>
                        <CardFooter className="p-8 pt-0 gap-3">
                          <Button type="submit" className="flex-1 h-12">{t.bookDetail.addChapter}</Button>
                          <Button type="button" variant="ghost" className="flex-1 h-12" onClick={() => setIsAddingChapter(false)}>{t.common.cancel}</Button>
                        </CardFooter>
                      </form>
                    </Card>
                  )}

                  {isEditingChapter && (
                    <Card className="glass border-primary/20 overflow-hidden">
                      <form onSubmit={updateChapter}>
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                          <CardTitle className="text-lg">{t.chapter.editTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'عنوان الفصل' : 'Chapter Title'}</Label>
                            <Input id="title" name="title" defaultValue={isEditingChapter.title} required className="bg-white/5 border-border focus:border-primary/50 h-12" />
                          </div>
                        </CardContent>
                        <CardFooter className="p-8 pt-0 gap-3">
                          <Button type="submit" className="flex-1 h-12">{language === 'ar' ? 'تحديث العنوان' : 'Update Title'}</Button>
                          <Button type="button" variant="ghost" className="flex-1 h-12" onClick={() => setIsEditingChapter(null)}>{t.common.cancel}</Button>
                        </CardFooter>
                      </form>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 gap-6">
                    {chapters.map((chapter, index) => {
                      const review = reviews.find(r => r.chapterId === chapter.id);
                      const isDue = review && (isBefore(review.nextReviewDate.toDate(), new Date()) || review.status === 'new');
                      
                      return (
                        <motion.div
                          key={chapter.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="glass hover:border-primary/40 transition-all group overflow-hidden card-glow">
                            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                              <div className="flex items-center gap-8 w-full">
                                <div className={cn(
                                  "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                                  isDue 
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]" 
                                    : "bg-green-500/10 border-green-500/30 text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                                )}>
                                  {isDue ? <Clock className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                                </div>
                                <div className="space-y-3">
                                  <h3 className="text-3xl font-bold tracking-tight text-white group-hover:text-primary transition-colors">{chapter.title}</h3>
                                </div>
                              </div>
                              <div className="flex gap-3 w-full md:w-auto">
                                <Tooltip content={t.chapter.editTitle} position="top">
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 md:flex-none h-14 w-14 p-0 border-white/10 hover:bg-white/10 rounded-2xl transition-all hover:scale-110"
                                    onClick={() => setIsEditingChapter(chapter)}
                                  >
                                    <Edit className="w-5 h-5" />
                                  </Button>
                                </Tooltip>
                                <Tooltip content={t.chapter.deleteChapter} position="top">
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 md:flex-none h-14 w-14 p-0 border-destructive/20 text-destructive hover:bg-destructive/10 rounded-2xl transition-all hover:scale-110"
                                    onClick={() => setIsDeletingChapter(chapter.id)}
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </Button>
                                </Tooltip>
                                <div className="w-px h-10 bg-white/10 my-auto mx-2 hidden md:block" />
                                <Button 
                                  variant="outline" 
                                  className="flex-1 md:flex-none h-14 px-8 border-white/10 hover:bg-white/10 rounded-2xl font-bold text-sm transition-all hover:scale-105"
                                  onClick={() => {
                                    setSelectedChapter(chapter);
                                    setView('editor');
                                  }}
                                >
                                  {t.chapter.editMap}
                                </Button>
                                {isDue && (
                                  <Button 
                                    className="flex-1 md:flex-none h-14 px-10 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 rounded-2xl font-bold text-sm shimmer transition-all hover:scale-105"
                                    onClick={() => {
                                      setSelectedChapter(chapter);
                                      setView('review');
                                    }}
                                  >
                                    <Brain className={cn("w-5 h-5", language === 'ar' ? "ml-3" : "mr-3")} />
                                    {t.chapter.startReview}
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {view === 'editor' && selectedChapter && (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-background flex flex-col"
                >
                  <div className="atmosphere" />
                  {/* Floating Header for Editor */}
                  <div className="absolute top-6 left-6 right-6 z-40 flex justify-end items-center pointer-events-none">
                    <div className="flex gap-3 pointer-events-auto">
                      <Button 
                        variant="outline" 
                        className="h-12 px-6 rounded-2xl glass border-primary/20 text-primary hover:bg-primary/10 shadow-2xl" 
                        onClick={() => {
                          saveMindMap(JSON.parse(selectedChapter.mindMap)); // Trigger save
                          toast.success(t.editor.saveHint);
                        }}
                      >
                        <Save className={cn("w-4 h-4", language === 'ar' ? "ml-2" : "mr-2")} />
                        {t.editor.save}
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="h-12 px-6 rounded-2xl glass border-white/10 text-white hover:bg-white/10 shadow-2xl" 
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

              {view === 'review' && selectedChapter && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-background"
                >
                  <div className="atmosphere" />
                  <ReviewMode 
                    chapterTitle={selectedChapter.title}
                    originalMindMap={JSON.parse(selectedChapter.mindMap)}
                    onComplete={completeReview}
                    onCancel={() => setView('book-detail')}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
      <Toaster position="top-center" />
      
      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {(isDeletingBook || isDeletingChapter) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsDeletingBook(null);
                setIsDeletingChapter(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass border-destructive/20 overflow-hidden rounded-3xl"
            >
              <div className="p-8 space-y-6 text-center">
                <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border border-destructive/20">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">{t.common.confirmDelete}</h3>
                  <p className="text-muted-foreground">
                    {isDeletingBook 
                      ? (language === 'ar' ? "سيتم حذف هذا الكتاب وجميع الفصول والخرائط الذهنية المرتبطة به بشكل نهائي." : "This book and all its associated chapters and mind maps will be permanently deleted.")
                      : (language === 'ar' ? "سيتم حذف هذا الفصل وجميع الخرائط الذهنية وجداول المراجعة المرتبطة به بشكل نهائي." : "This chapter and all its associated mind maps and review schedules will be permanently deleted.")}
                    {t.common.deleteWarning}
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="destructive" 
                    className="flex-1 h-12 font-bold"
                    onClick={() => {
                      if (isDeletingBook) deleteBook(isDeletingBook);
                      else if (isDeletingChapter) deleteChapter(isDeletingChapter);
                    }}
                  >
                    {t.common.yesDelete}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="flex-1 h-12 hover:bg-white/10"
                    onClick={() => {
                      setIsDeletingBook(null);
                      setIsDeletingChapter(null);
                    }}
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
              onClick={() => {
                setIsEditingBook(null);
                setCoverBase64('');
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl glass border-white/10 overflow-hidden rounded-3xl"
            >
              <form onSubmit={updateBook}>
                <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
                  <CardTitle className="text-2xl font-bold">{t.bookDetail.editBook}</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'عنوان الكتاب' : 'Book Title'}</Label>
                      <Input id="title" name="title" defaultValue={isEditingBook.title} required className="bg-white/5 border-border focus:border-primary/50 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author" className="text-xs uppercase tracking-widest text-muted-foreground">{t.bookDetail.author}</Label>
                      <Input id="author" name="author" defaultValue={isEditingBook.author} className="bg-white/5 border-border focus:border-primary/50 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalChapters" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'إجمالي عدد الفصول' : 'Total Chapters'}</Label>
                      <Input id="totalChapters" name="totalChapters" type="number" defaultValue={isEditingBook.totalChapters} required min="1" className="bg-white/5 border-border focus:border-primary/50 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cover" className="text-xs uppercase tracking-widest text-muted-foreground">{language === 'ar' ? 'تغيير الغلاف' : 'Change Cover'}</Label>
                      <div className="flex gap-3">
                        <Input 
                          id="cover" 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileChange}
                          className="bg-white/5 border-border focus:border-primary/50 h-12 pt-2" 
                        />
                        {coverBase64 && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden glass border-white/10 shrink-0">
                            <img src={coverBase64} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-8 pt-0 gap-3">
                  <Button type="submit" className="flex-1 h-12 shadow-lg shadow-primary/20">{language === 'ar' ? 'تحديث البيانات' : 'Update Data'}</Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="flex-1 h-12" 
                    onClick={() => {
                      setIsEditingBook(null);
                      setCoverBase64('');
                    }}
                  >
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

