import { useState, useEffect } from 'react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

import { 
  RefreshCw, 
  Zap, 
  MessageSquare, 
  Image as ImageIcon, 
  Copy, 
  Send, 
  Check, 
  TrendingUp, 
  Newspaper, 
  Lightbulb,
  Sparkles,
  ChevronRight,
  Edit3,
  Eye,
  Download,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  fetchLatestNews, 
  generatePostIdeas, 
  generateFullPost, 
  NewsItem, 
  PostIdea, 
  PostPackage 
} from '../services/gemini';
import { formatForLinkedIn } from '../lib/unicode';

export default function Dashboard() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNewsIds, setSelectedNewsIds] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<PostIdea | null>(null);
  const [customIdea, setCustomIdea] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [postPackage, setPostPackage] = useState<PostPackage | null>(null);
  const [ideaComments, setIdeaComments] = useState<Record<string, string>>({});
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [loading, setLoading] = useState({ news: false, ideas: false, post: false, image: false });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [activeTab, setActiveTab] = useState<'news' | 'editor' | 'ideas'>('news');
  const [testStatus, setTestStatus] = useState<{ loading: boolean, result: string | null, error: string | null }>({ loading: false, result: null, error: null });

  useEffect(() => {
    handleRefreshNews();
  }, []);

  const handleTestKey = async () => {
    setTestStatus({ loading: true, result: null, error: null });
    try {
      const response = await fetch('/api/test-key');
      const data = await response.json();
      if (data.success) {
        setTestStatus({ loading: false, result: data.message, error: null });
      } else {
        setTestStatus({ loading: false, result: null, error: data.error });
      }
    } catch (error: any) {
      setTestStatus({ loading: false, result: null, error: error.message });
    }
    setTimeout(() => setTestStatus(prev => ({ ...prev, result: null, error: null })), 5000);
  };

  const handleRefreshNews = async () => {
    setLoading(prev => ({ ...prev, news: true }));
    setError(null);
    try {
      const latestNews = await fetchLatestNews();
      // Ranking by viralityScore descending
      const sortedNews = [...latestNews].sort((a, b) => b.viralityScore - a.viralityScore);
      setNews(sortedNews);
      setSelectedNewsIds([]); // Reset selection on refresh
    } catch (err: any) {
      console.error("Failed to fetch news:", err);
      if (err.message?.includes("API_KEY_MISSING")) {
        setError("API Key Missing: Please set your GEMINI_API_KEY in the Secrets panel (Settings > Secrets).");
      } else if (err.message?.includes("API key not valid")) {
        setError("The provided Gemini API Key is invalid. Please check your key in Settings > Secrets.");
      } else {
        setError(err.message || "Failed to fetch latest AI news. Please check your API key and try again.");
      }
    } finally {
      setLoading(prev => ({ ...prev, news: false }));
    }
  };

  const toggleNewsSelection = (id: string) => {
    setSelectedNewsIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleGenerateIdeas = async () => {
    setLoading(prev => ({ ...prev, ideas: true }));
    setError(null);
    try {
      const selectedItems = news.filter(item => selectedNewsIds.includes(item.id));
      const generatedIdeas = await generatePostIdeas(selectedItems, customContext);
      setIdeas(generatedIdeas);
      setCustomContext(''); // Clear custom context after generation
      setActiveTab('ideas');
    } catch (err: any) {
      console.error("Failed to generate ideas:", err);
      if (err.message?.includes("API_KEY_MISSING")) {
        setError("API Key Missing: Please set your GEMINI_API_KEY in the Secrets panel.");
      } else if (err.message?.includes("API key not valid")) {
        setError("The provided Gemini API Key is invalid. Please check your key in Settings > Secrets.");
      } else {
        setError(err.message || "Failed to generate post ideas. Please try again.");
      }
    } finally {
      setLoading(prev => ({ ...prev, ideas: false }));
    }
  };

  const handleGeneratePost = async (idea: PostIdea | string | undefined, commentsOverride?: string) => {
    setLoading(prev => ({ ...prev, post: true }));
    setError(null);
    setActiveTab('editor');
    setGeneratedImage(null); // Reset image for new post
    setIsEditingPrompt(false);
    try {
      const comments = commentsOverride || (idea && typeof idea !== 'string' ? ideaComments[idea.id] : '');
      const pkg = await generateFullPost(idea || '', comments);
      setPostPackage(pkg);
    } catch (err: any) {
      console.error("Failed to generate post:", err);
      if (err.message?.includes("API_KEY_MISSING")) {
        setError("API Key Missing: Please set your GEMINI_API_KEY in the Secrets panel.");
      } else if (err.message?.includes("API key not valid")) {
        setError("The provided Gemini API Key is invalid. Please check your key in Settings > Secrets.");
      } else {
        setError(err.message || "Failed to generate full post. Please try again.");
      }
    } finally {
      setLoading(prev => ({ ...prev, post: false }));
    }
  };

  const handleCopy = (text: string, id: string) => {
    const formatted = formatForLinkedIn(text);
    navigator.clipboard.writeText(formatted);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegenerateHook = async () => {
    if (!postPackage) return;
    setLoading(prev => ({ ...prev, post: true }));
    try {
      const { regenerateHook } = await import('../services/gemini');
      const newHook = await regenerateHook(postPackage.formattedPost);
      const lines = postPackage.formattedPost.split('\n');
      lines[0] = newHook;
      setPostPackage({ ...postPackage, formattedPost: lines.join('\n') });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, post: false }));
    }
  };

  const handleGenerateImage = async () => {
    if (!postPackage) return;
    setLoading(prev => ({ ...prev, image: true }));
    try {
      const { generateImage } = await import('../services/gemini');
      const imageUrl = await generateImage(postPackage.imagePrompt);
      setGeneratedImage(imageUrl);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, image: false }));
    }
  };

  const handleRegenerateImageConcept = async () => {
    if (!postPackage) return;
    setLoading(prev => ({ ...prev, post: true }));
    try {
      const { regenerateImageConcept } = await import('../services/gemini');
      const { concept, prompt } = await regenerateImageConcept(postPackage.formattedPost);
      setPostPackage({ ...postPackage, imageConcept: concept, imagePrompt: prompt });
      setGeneratedImage(null); // Reset image for new concept
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, post: false }));
    }
  };

  const handleSwapAnalogy = (newAnalogy: string) => {
    if (!postPackage) return;
    handleGeneratePost(selectedIdea || customIdea, `Please use this specific analogy instead of the current one: ${newAnalogy}`);
  };

  const handleSaveDraft = () => {
    if (!postPackage) return;
    const drafts = JSON.parse(localStorage.getItem('mayur_drafts') || '[]');
    drafts.push({ ...postPackage, date: new Date().toISOString() });
    localStorage.setItem('mayur_drafts', JSON.stringify(drafts));
    setCopied('draft');
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePublish = () => {
    if (!postPackage) return;
    const formatted = formatForLinkedIn(postPackage.formattedPost);
    navigator.clipboard.writeText(formatted);
    
    // Open LinkedIn feed
    window.open('https://www.linkedin.com/feed/', '_blank');
    
    alert("🚀 Redirecting to LinkedIn!\n\n1. Your formatted post has been copied to clipboard.\n2. LinkedIn is opening in a new tab.\n3. Click 'Start a post' and PASTE your content.\n4. The bold/italic Unicode characters will persist!\n5. If you generated an image, save it and upload it too.");
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Just now';
      // Format to IST (Asia/Kolkata)
      const date = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Kolkata'
      });
      const time = d.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      });
      return `${date}, ${time} IST`;
    } catch (e) {
      return 'Just now';
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-[#0A66C2]/20">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-2xl border-b border-gray-200/30 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-gradient-to-br from-[#0A66C2] to-[#004182] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <Zap className="w-7 h-7 fill-current" />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl tracking-tight leading-none text-[#1D1D1F]">MakIN</h1>
              <p className="text-[11px] font-bold text-[#0A66C2] uppercase tracking-[0.2em] mt-1.5 opacity-80">LinkedIN Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <button 
                onClick={handleTestKey}
                disabled={testStatus.loading}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all ${testStatus.error ? 'border-red-200 text-red-500 bg-red-50' : testStatus.result ? 'border-green-200 text-green-500 bg-green-50' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
              >
                {testStatus.loading ? 'Testing...' : testStatus.error ? 'Key Invalid' : testStatus.result ? 'Key OK' : 'Test API Key'}
              </button>
              {testStatus.error && (
                <span className="text-[8px] text-red-400 mt-1 max-w-[150px] truncate text-right">{testStatus.error}</span>
              )}
            </div>
            <button 
              onClick={handleRefreshNews}
              disabled={loading.news}
              className="group flex items-center gap-2.5 text-sm font-bold text-[#0A66C2] hover:bg-blue-50/80 px-5 py-2.5 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-blue-100"
            >
              <RefreshCw className={`w-4 h-4 transition-transform duration-700 ${loading.news ? 'animate-spin' : 'group-hover:rotate-180'}`} />
              <span className="hidden sm:inline">Refresh Feed</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 lg:py-10">
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-500 transition-colors"
              >
                <RefreshCw className="w-4 h-4 rotate-45" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Mobile Tab Navigation */}
        <div className="lg:hidden flex bg-white/60 backdrop-blur-lg border border-white/40 rounded-2xl mb-8 sticky top-20 z-40 p-1.5 shadow-xl shadow-black/5">
          <button 
            onClick={() => setActiveTab('news')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-xl ${activeTab === 'news' ? 'bg-white text-[#0A66C2] shadow-sm' : 'text-gray-500 hover:bg-white/40'}`}
          >
            News
          </button>
          <button 
            onClick={() => setActiveTab('ideas')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-xl ${activeTab === 'ideas' ? 'bg-white text-[#0A66C2] shadow-sm' : 'text-gray-500 hover:bg-white/40'}`}
          >
            Ideas
          </button>
          <button 
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-xl ${activeTab === 'editor' ? 'bg-white text-[#0A66C2] shadow-sm' : 'text-gray-500 hover:bg-white/40'}`}
          >
            Editor
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: News Feed */}
          <section className={`lg:col-span-3 space-y-8 ${activeTab !== 'news' ? 'hidden lg:block' : 'block'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-2xl tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center shadow-sm">
                  <Newspaper className="w-5 h-5 text-[#0A66C2]" />
                </div>
                Viral AI Feed
              </h2>
            </div>
            
            <div className="space-y-4 lg:max-h-[calc(100vh-420px)] lg:overflow-y-auto pr-1 lg:pr-3 custom-scrollbar pb-10 lg:pb-0">
              {loading.news ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] border border-white/60 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded-full w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-100 rounded-full w-1/2 mb-5"></div>
                    <div className="h-12 bg-gray-50/50 rounded-xl"></div>
                  </div>
                ))
              ) : news.length > 0 ? (
                news.map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i} 
                    onClick={() => toggleNewsSelection(item.id)}
                    className={`p-6 rounded-[2rem] border transition-all cursor-pointer group relative active:scale-[0.99] ${selectedNewsIds.includes(item.id) ? 'border-[#0A66C2] bg-white shadow-2xl shadow-blue-500/10' : 'border-white/60 bg-white/40 hover:bg-white hover:shadow-2xl hover:shadow-black/5'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0A66C2] bg-blue-50/50 px-2.5 py-1 rounded-lg w-fit">
                          {item.category}
                        </span>
                        <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md w-fit">
                          {item.viralityScore}% Viral Potential
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${selectedNewsIds.includes(item.id) ? 'bg-[#0A66C2] border-[#0A66C2] scale-110 shadow-lg shadow-blue-500/20' : 'border-gray-200 group-hover:border-[#0A66C2]'}`}>
                          {selectedNewsIds.includes(item.id) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    </div>
                    <h3 className="font-bold text-[15px] leading-tight mb-2.5 group-hover:text-[#0A66C2] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 hover:text-[#0A66C2] transition-colors"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                        {item.source}
                      </a>
                      <span>{formatDate(item.timestamp)}</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-16 bg-white/30 rounded-[2.5rem] border border-dashed border-gray-300 text-gray-400 italic text-sm">
                  No news found. Try refreshing.
                </div>
              )}
            </div>
            
            <div className="pt-10 mt-10 border-t border-gray-200/30 space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">Custom Context</label>
                <textarea 
                  placeholder="Paste a link or custom angle..."
                  className="w-full h-32 p-6 text-sm bg-white/50 backdrop-blur-sm border border-white/60 rounded-[2rem] focus:ring-4 focus:ring-[#0A66C2]/10 focus:border-[#0A66C2] outline-none resize-none transition-all placeholder:text-gray-400 shadow-inner"
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                />
              </div>
              <button 
                onClick={handleGenerateIdeas}
                disabled={loading.ideas || (selectedNewsIds.length === 0 && !customContext.trim())}
                className="w-full bg-[#0A66C2] text-white font-extrabold py-5 rounded-[2rem] flex items-center justify-center gap-3.5 hover:bg-[#004182] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-blue-500/20 active:scale-95"
              >
                <Sparkles className="w-5 h-5" />
                Generate Ideas {selectedNewsIds.length > 0 ? `(${selectedNewsIds.length})` : ''}
              </button>
            </div>
          </section>

          {/* Center: Editor & Preview */}
          <section className={`lg:col-span-6 space-y-8 ${activeTab !== 'editor' ? 'hidden lg:block' : 'block'}`}>
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 overflow-hidden shadow-2xl shadow-black/5">
              <div className="border-b border-gray-100/30 px-10 py-6 flex items-center justify-between bg-white/40">
                <div className="flex bg-gray-100/50 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setViewMode('preview')}
                    className={`text-xs font-bold flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all ${viewMode === 'preview' ? 'bg-white text-[#0A66C2] shadow-sm' : 'text-gray-500 hover:bg-white/40'}`}
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button 
                    onClick={() => setViewMode('edit')}
                    className={`text-xs font-bold flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all ${viewMode === 'edit' ? 'bg-white text-[#0A66C2] shadow-sm' : 'text-gray-500 hover:bg-white/40'}`}
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                {postPackage && (
                  <button 
                    onClick={() => handleCopy(postPackage.formattedPost, 'main-post')}
                    className="bg-[#0A66C2] text-white text-xs font-bold px-6 py-3 rounded-2xl flex items-center gap-2.5 hover:bg-[#004182] transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                  >
                    {copied === 'main-post' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    Copy Post
                  </button>
                )}
              </div>

              <div className="p-10">
                {loading.post ? (
                  <div className="space-y-8 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-100 rounded-full"></div>
                      <div className="h-4 bg-gray-100 rounded-full"></div>
                      <div className="h-4 bg-gray-100 rounded-full w-5/6"></div>
                    </div>
                    <div className="h-80 bg-gray-100 rounded-[2.5rem]"></div>
                  </div>
                ) : postPackage ? (
                  <div className="space-y-12">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">LinkedIn Content</h3>
                      <button 
                        onClick={handleRegenerateHook}
                        className="text-[11px] font-bold text-[#0A66C2] hover:bg-blue-50/80 px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-transparent hover:border-blue-100"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate Hook
                      </button>
                    </div>
                    {viewMode === 'preview' ? (
                      <div className="whitespace-pre-wrap font-sans text-[17px] leading-relaxed text-[#1D1D1F] bg-white/50 p-8 rounded-[2rem] border border-white/60 shadow-inner">
                        {formatForLinkedIn(postPackage.formattedPost).split(/(Follow Mayur Kapur|---)/g).map((part, i) => {
                          if (part === 'Follow Mayur Kapur') {
                            return (
                              <a 
                                key={i} 
                                href="https://www.linkedin.com/in/mayurkapur/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[#0A66C2] hover:underline font-semibold"
                              >
                                {part}
                              </a>
                            );
                          }
                          if (part === '---') {
                            return <hr key={i} className="my-6 border-gray-200" />;
                          }
                          return part;
                        })}
                      </div>
                    ) : (
                      <textarea 
                        className="w-full h-[550px] p-8 bg-white/50 backdrop-blur-sm border border-white/60 rounded-[2rem] focus:ring-4 focus:ring-[#0A66C2]/10 focus:border-[#0A66C2] outline-none font-mono text-[15px] leading-relaxed transition-all shadow-inner"
                        value={postPackage.formattedPost}
                        onChange={(e) => setPostPackage({ ...postPackage, formattedPost: e.target.value })}
                      />
                    )}

                    {/* Alternative Analogies */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-[#0A66C2] font-bold text-sm">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Lightbulb className="w-3.5 h-3.5" />
                        </div>
                        Alternative Analogies
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {postPackage.alternativeAnalogies.map((analogy, i) => (
                          <button
                            key={i}
                            onClick={() => handleSwapAnalogy(analogy)}
                            className="text-left p-4 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all group"
                          >
                            <p className="text-sm text-gray-600 group-hover:text-gray-900 italic">"{analogy}"</p>
                            <span className="text-[10px] font-bold text-[#0A66C2] mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">Click to use this analogy →</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Visual Assets */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[#0A66C2] font-bold text-sm">
                          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                          Visual Strategy (gemini-2.5-flash-image)
                        </div>
                        <button 
                          onClick={handleRegenerateImageConcept}
                          className="text-[10px] font-bold text-[#0A66C2] hover:bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regenerate Concept
                        </button>
                      </div>

                      {generatedImage ? (
                        <div className="relative group rounded-[2rem] overflow-hidden border border-white/60 shadow-2xl">
                          <img 
                            src={generatedImage} 
                            alt="Generated AI Asset" 
                            className="w-full aspect-square object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button 
                              onClick={() => window.open(generatedImage, '_blank')}
                              className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1D1D1F] hover:scale-110 transition-transform"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </button>
                            <a 
                              href={generatedImage} 
                              download="mayur-post-image.png"
                              className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1D1D1F] hover:scale-110 transition-transform"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          </div>
                          <button 
                            onClick={handleGenerateImage}
                            disabled={loading.image}
                            className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md text-[#0A66C2] font-bold px-6 py-3 rounded-2xl text-xs shadow-xl hover:bg-white transition-all active:scale-95 flex items-center gap-2"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading.image ? 'animate-spin' : ''}`} />
                            Regenerate Image
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white/40 p-12 rounded-[2.5rem] border border-dashed border-gray-300 flex flex-col items-center justify-center text-center space-y-4">
                          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0A66C2]">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                          <div className="max-w-xs">
                            <h4 className="font-bold text-gray-500">Generate Visual Asset</h4>
                            <p className="text-xs text-gray-400 mt-1">Bring your strategic concept to life with gemini-2.5-flash-image.</p>
                          </div>
                          <button 
                            onClick={handleGenerateImage}
                            disabled={loading.image}
                            className="bg-[#0A66C2] text-white font-bold px-8 py-3.5 rounded-2xl text-sm shadow-xl shadow-blue-500/20 hover:bg-[#004182] transition-all active:scale-95 flex items-center gap-2"
                          >
                            {loading.image ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {loading.image ? 'Generating...' : 'Generate Image'}
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/40 p-5 rounded-2xl border border-white/60">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Concept</p>
                          <p className="text-sm text-gray-700 italic leading-relaxed">{postPackage.imageConcept}</p>
                        </div>
                        <div className="bg-white/40 p-5 rounded-2xl border border-white/60">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">gemini-2.5-flash-image Prompt</p>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                                className="text-[10px] font-bold text-[#0A66C2] hover:underline"
                              >
                                {isEditingPrompt ? 'Done' : 'Edit'}
                              </button>
                              <button 
                                onClick={() => handleCopy(postPackage.imagePrompt, 'prompt')}
                                className="text-[10px] font-bold text-[#0A66C2] hover:underline"
                              >
                                {copied === 'prompt' ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          {isEditingPrompt ? (
                            <textarea 
                              className="w-full h-24 p-3 text-[11px] font-mono bg-white/80 rounded-xl border border-[#0A66C2]/30 outline-none focus:border-[#0A66C2] transition-all"
                              value={postPackage.imagePrompt}
                              onChange={(e) => setPostPackage({ ...postPackage, imagePrompt: e.target.value })}
                            />
                          ) : (
                            <p className="text-[11px] text-gray-600 font-mono bg-white/60 p-3 rounded-xl border border-white/80 line-clamp-4">
                              {postPackage.imagePrompt}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-[#0A66C2] font-bold text-sm">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                        Engagement Strategy
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#0A66C2]/5 p-5 rounded-2xl border border-[#0A66C2]/10">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest">First Comment</p>
                            <button 
                              onClick={() => handleCopy(postPackage.firstComment, 'comment1')}
                              className="text-[10px] font-bold text-[#0A66C2] hover:underline"
                            >
                              {copied === 'comment1' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{postPackage.firstComment}</p>
                        </div>
                        <div className="bg-white/40 p-5 rounded-2xl border border-white/60">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Second Comment</p>
                            <button 
                              onClick={() => handleCopy(postPackage.secondComment, 'comment2')}
                              className="text-[10px] font-bold text-[#0A66C2] hover:underline"
                            >
                              {copied === 'comment2' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{postPackage.secondComment}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end pt-8 border-t border-gray-100/50">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={handleSaveDraft}
                          className="text-sm font-bold text-gray-400 hover:text-gray-600 px-4 py-2 transition-colors"
                        >
                          Save Draft
                        </button>
                        <button 
                          onClick={handlePublish}
                          className="bg-[#0A66C2] text-white font-bold px-10 py-4 rounded-2xl flex items-center gap-3 hover:bg-[#004182] transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                          Copy & Open LinkedIn
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                    <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-200 shadow-inner">
                      <Zap className="w-10 h-10" />
                    </div>
                    <div className="max-w-xs">
                      <h3 className="font-bold text-gray-400 text-lg">Ready to Create?</h3>
                      <p className="text-sm text-gray-400 mt-2">Select viral news or add your own context to start generating strategic content.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right: Ideas & Custom Input */}
          <section className={`lg:col-span-3 space-y-8 ${activeTab !== 'ideas' ? 'hidden lg:block' : 'block'}`}>
            <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/60 shadow-2xl shadow-black/5">
              <h2 className="font-bold text-2xl tracking-tight flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center shadow-sm">
                  <Lightbulb className="w-5 h-5 text-amber-600" />
                </div>
                Post Ideas
              </h2>

              <div className="space-y-6">
                {loading.ideas ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-40 bg-gray-50/50 rounded-[2rem] animate-pulse"></div>
                  ))
                ) : ideas.length > 0 ? (
                  ideas.map((idea, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedIdea(idea);
                        handleGeneratePost(idea);
                      }}
                      className={`w-full text-left p-6 rounded-[2rem] border transition-all group active:scale-[0.99] ${selectedIdea?.id === idea.id ? 'border-[#0A66C2] bg-white shadow-2xl shadow-blue-500/10' : 'border-white/60 bg-white/40 hover:bg-white hover:shadow-2xl hover:shadow-black/5'}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-[#0A66C2] flex items-center gap-1.5 bg-blue-50/50 px-2.5 py-1 rounded-lg w-fit">
                            <TrendingUp className="w-3 h-3" />
                            {idea.viralityScore}% Viral
                          </span>
                          <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1.5 bg-amber-50/50 px-2 py-0.5 rounded-md w-fit uppercase tracking-wider">
                            Strategic
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#0A66C2] transition-transform group-hover:translate-x-1 duration-300" />
                      </div>
                      <h4 className="text-[15px] font-bold mb-3 leading-tight group-hover:text-[#0A66C2] transition-colors">{idea.title}</h4>
                      <p className="text-[11px] text-gray-400 italic mb-4 line-clamp-1 opacity-80">"{idea.hook}"</p>
                      <p className="text-[12px] text-gray-600 line-clamp-4 leading-relaxed border-t border-gray-100/50 pt-4 opacity-90 mb-6">
                        {idea.detailedAngle}
                      </p>
                      
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <textarea 
                          placeholder="Add your own comments/thoughts for this idea..."
                          className="w-full h-20 p-4 text-xs bg-white/60 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] outline-none resize-none transition-all placeholder:text-gray-400"
                          value={ideaComments[idea.id] || ''}
                          onChange={(e) => setIdeaComments({ ...ideaComments, [idea.id]: e.target.value })}
                        />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-16 bg-white/30 rounded-[2.5rem] border border-dashed border-gray-300 text-gray-400 italic text-sm">
                    Select news items and generate ideas to see them here.
                  </div>
                )}
              </div>

              <div className="mt-12 pt-12 border-t border-gray-200/30">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center shadow-sm">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                  </div>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Quick Angle</h3>
                </div>
                <div className="space-y-5">
                  <textarea 
                    placeholder="Type a custom thought..."
                    className="w-full h-32 p-6 text-sm bg-white/50 backdrop-blur-sm border border-white/60 rounded-[2rem] focus:ring-4 focus:ring-[#0A66C2]/10 focus:border-[#0A66C2] outline-none resize-none transition-all placeholder:text-gray-400 shadow-inner"
                    value={customIdea}
                    onChange={(e) => setCustomIdea(e.target.value)}
                  />
                  <button 
                    onClick={() => handleGeneratePost(customIdea)}
                    disabled={!customIdea.trim() || loading.post}
                    className="w-full bg-white border border-[#0A66C2] text-[#0A66C2] font-extrabold py-4 rounded-[2rem] text-sm hover:bg-blue-50 transition-all disabled:opacity-30 active:scale-95 shadow-lg shadow-blue-500/5"
                  >
                    Use Custom Idea
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Toast Notification for Copy */}
      <AnimatePresence>
        {copied && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1D1D1D] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100]"
          >
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm font-bold">Copied with formatting preserved!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
