import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, User, Cpu, RefreshCw, Loader2, Image as ImageIcon, 
  X, Paintbrush, Menu, Settings, 
  MessageSquare, HelpCircle, Mail, Camera, ChevronLeft
} from 'lucide-react';
import { streamMessage, resetChat, generateImage } from './services/geminiService';
import { db } from './services/database';
import MarkdownRenderer from './components/MarkdownRenderer';
import { Message, LoadingState, UserProfile } from './types';
import { WELCOME_MESSAGE } from './constants';

const DEFAULT_USER: UserProfile = {
  name: 'Mehmon',
  email: 'guest@sevnex.ai',
  avatar: undefined
};

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER);
  const [activeView, setActiveView] = useState<'chat' | 'settings' | 'support'>('chat');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Chat States
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [selectedImage, setSelectedImage] = useState<{ mimeType: string; data: string } | undefined>(undefined);
  const [mode, setMode] = useState<'chat' | 'generate-image'>('chat');

  // Settings & Support States
  const [editName, setEditName] = useState(DEFAULT_USER.name);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubject, setSupportSubject] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const initApp = async () => {
      const savedSession = sessionStorage.getItem('sevnex_session');
      let currentUser = DEFAULT_USER;

      if (savedSession) {
        try {
          currentUser = JSON.parse(savedSession);
        } catch (e) {
          console.error("Session parse error", e);
        }
      }
      await loadUserData(currentUser);
    };
    initApp();
  }, []);

  // Save history automatically
  useEffect(() => {
    const saveToDb = async () => {
      if (userProfile && messages.length > 0) {
        if (messages.length === 1 && messages[0].id === 'welcome') return;
        try {
          await db.saveHistory(userProfile.email, messages);
        } catch (error) { console.error(error); }
      }
    };
    const timer = setTimeout(saveToDb, 1000);
    return () => clearTimeout(timer);
  }, [messages, userProfile]);

  const loadUserData = async (user: UserProfile) => {
    setUserProfile(user);
    setEditName(user.name);
    setAvatarPreview(user.avatar);
    
    try {
      const history = await db.getHistory(user.email);
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: 'welcome',
          role: 'model',
          text: WELCOME_MESSAGE.replace('Assalomu alaykum!', `Xush kelibsiz, ${user.name}!`),
          timestamp: new Date(),
        }]);
      }
    } catch (e) {
      setMessages([{
        id: 'welcome',
        role: 'model',
        text: WELCOME_MESSAGE.replace('Assalomu alaykum!', `Xush kelibsiz, ${user.name}!`),
        timestamp: new Date(),
      }]);
    }
  };

  // --- HANDLERS ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingState, selectedImage]);

  const handleResetChat = async () => {
    if (window.confirm("Chat tarixini tozalashni tasdiqlaysizmi?")) {
      setMessages([{
          id: 'welcome',
          role: 'model',
          text: WELCOME_MESSAGE.replace('Assalomu alaykum!', `Xush kelibsiz, ${userProfile.name}!`),
          timestamp: new Date(),
      }]);
      resetChat();
      try { await db.saveHistory(userProfile.email, []); } catch(e) {}
      setSidebarOpen(false);
    }
  };

  const handleSaveProfile = () => {
    const updated = { ...userProfile, name: editName, avatar: avatarPreview };
    setUserProfile(updated);
    sessionStorage.setItem('sevnex_session', JSON.stringify(updated));
    alert("Profil saqlandi!");
    setActiveView('chat');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
        setMode('chat');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !selectedImage) || loadingState !== LoadingState.IDLE) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue.trim(),
      timestamp: new Date(),
      attachment: selectedImage
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSelectedImage(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Image Generation Mode
    if (mode === 'generate-image') {
      setLoadingState(LoadingState.GENERATING_IMAGE);
      const botId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botId, role: 'model', text: "🎨 Chizilmoqda...", isStreaming: true, timestamp: new Date()
      }]);

      try {
        const imgData = await generateImage(userMsg.text);
        setMessages(prev => prev.map(m => m.id === botId ? {
          ...m, text: "Mana natija! 🖌️", generatedImage: imgData, isStreaming: false
        } : m));
      } catch (e) {
        setMessages(prev => prev.map(m => m.id === botId ? {
          ...m, text: "Rasm chizishda xatolik bo'ldi.", isStreaming: false
        } : m));
      } finally {
        setLoadingState(LoadingState.IDLE);
      }
      return;
    }

    // Chat Mode
    setLoadingState(LoadingState.STREAMING);
    const botId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: botId, role: 'model', text: '', isStreaming: true, timestamp: new Date()
    }]);

    try {
      await streamMessage(userMsg.text, userMsg.attachment, (chunk) => {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: m.text + chunk } : m));
      });
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, isStreaming: false } : m));
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === botId ? {
        ...m, text: m.text + "\n\nXatolik yuz berdi.", isStreaming: false
      } : m));
    } finally {
      setLoadingState(LoadingState.IDLE);
    }
  };

  // --- RENDER HELPERS ---
  const renderSidebar = () => (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar Content */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full w-[280px] bg-[#0a0a14] border-r border-white/10 z-50 transform transition-transform duration-300 ease-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
               <Cpu className="w-5 h-5 text-white" />
             </div>
             <span className="font-bold text-xl logo-font tracking-widest text-white">SEVNEX</span>
           </div>
           <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400">
             <X className="w-6 h-6" />
           </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'text-neon-blue' },
            { id: 'settings', label: 'Sozlamalar', icon: Settings, color: 'text-neon-purple' },
            { id: 'support', label: 'Yordam', icon: HelpCircle, color: 'text-green-400' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id as any); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeView === item.id 
                  ? 'bg-white/10 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                  : 'hover:bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeView === item.id ? item.color : ''}`} />
              <span className={`font-medium ${activeView === item.id ? 'text-white' : ''}`}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-white/5">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/20">
               {userProfile.avatar ? (
                 <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-400"><User className="w-5 h-5" /></div>
               )}
             </div>
             <div className="overflow-hidden">
               <p className="text-white font-medium truncate text-sm">{userProfile.name}</p>
               <p className="text-xs text-neon-blue">Online</p>
             </div>
          </div>
          <button 
            onClick={handleResetChat}
            className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Tozalash
          </button>
        </div>
      </aside>
    </>
  );

  // --- MAIN LAYOUT ---
  return (
    <div className="flex w-full h-full bg-[#050510] text-slate-200 overflow-hidden">
      {renderSidebar()}

      {/* Main Content Area - Flex Column */}
      <div className="flex-1 flex flex-col h-full relative w-full min-w-0">
        
        {/* Background Gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] bg-neon-purple/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[70%] h-[70%] bg-neon-blue/5 rounded-full blur-[100px]" />
        </div>

        {/* Header (Mobile Only) */}
        <header className="h-14 shrink-0 border-b border-white/5 bg-[#0a0a14]/80 backdrop-blur-md flex items-center justify-between px-4 md:hidden z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1 text-slate-300">
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-lg logo-font">SEVNEX</span>
          </div>
          <div className="flex items-center gap-2">
             {activeView !== 'chat' && (
                <button onClick={() => setActiveView('chat')} className="text-neon-blue text-sm font-medium flex items-center">
                   <ChevronLeft className="w-4 h-4" /> Chat
                </button>
             )}
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto relative z-10 w-full scroll-smooth">
          
          {/* View: Settings */}
          {activeView === 'settings' && (
            <div className="p-6 max-w-lg mx-auto animate-fade-in pb-20">
               <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple logo-font">Profil</h2>
               <div className="glass-panel p-6 rounded-2xl space-y-6">
                  <div className="flex flex-col items-center gap-4">
                     <div className="relative w-24 h-24 group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                        <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/20">
                           {avatarPreview ? (
                             <img src={avatarPreview} className="w-full h-full object-cover" />
                           ) : (
                             <div className="w-full h-full bg-slate-800 flex items-center justify-center"><User className="w-8 h-8 text-slate-500" /></div>
                           )}
                        </div>
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Camera className="w-6 h-6 text-white" />
                        </div>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                     </div>
                     <input 
                       type="text" 
                       value={editName}
                       onChange={(e) => setEditName(e.target.value)}
                       className="bg-transparent border-b border-white/20 text-center text-xl font-medium focus:border-neon-blue outline-none px-2 py-1 w-full"
                       placeholder="Ismingiz"
                     />
                  </div>
                  <button onClick={handleSaveProfile} className="w-full bg-neon-blue/20 text-neon-blue border border-neon-blue/40 py-3 rounded-xl font-bold hover:bg-neon-blue/30 transition-all">
                     SAQLASH
                  </button>
               </div>
            </div>
          )}

          {/* View: Support */}
          {activeView === 'support' && (
            <div className="p-6 max-w-lg mx-auto animate-fade-in pb-20">
              <h2 className="text-2xl font-bold mb-6 text-green-400 logo-font">Yordam</h2>
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <input 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 transition-colors"
                  placeholder="Mavzu"
                  value={supportSubject}
                  onChange={e => setSupportSubject(e.target.value)}
                />
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400 transition-colors h-32 resize-none"
                  placeholder="Xabaringiz..."
                  value={supportMessage}
                  onChange={e => setSupportMessage(e.target.value)}
                />
                <button 
                  onClick={() => {
                     window.location.href = `mailto:support@sevnex.uz?subject=${supportSubject}&body=${supportMessage}`;
                  }}
                  className="w-full bg-green-500/20 text-green-400 border border-green-500/40 py-3 rounded-xl font-bold hover:bg-green-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" /> YUBORISH
                </button>
              </div>
            </div>
          )}

          {/* View: Chat (Messages) */}
          {activeView === 'chat' && (
            <div className="p-4 space-y-6 pb-4">
               {messages.map((msg) => (
                 <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 relative shadow-lg ${
                       msg.role === 'user' 
                         ? 'bg-gradient-to-br from-neon-blue/20 to-blue-600/20 border border-neon-blue/30 rounded-br-sm' 
                         : 'glass-panel border-white/10 rounded-bl-sm'
                    }`}>
                       {/* Message Icon */}
                       <div className={`absolute -top-3 w-7 h-7 rounded-full flex items-center justify-center border text-white shadow-sm ${
                          msg.role === 'user' 
                            ? '-right-2 bg-slate-800 border-neon-blue/40' 
                            : '-left-2 bg-gradient-to-br from-neon-blue to-neon-purple border-white/20'
                       }`}>
                          {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                       </div>

                       {/* Content */}
                       {msg.attachment && (
                          <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/30">
                             <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} className="max-h-[200px] object-contain mx-auto" />
                          </div>
                       )}
                       
                       {msg.generatedImage ? (
                          <div className="space-y-2">
                             <p className="text-sm text-slate-300">{msg.text}</p>
                             <img src={`data:image/png;base64,${msg.generatedImage}`} className="w-full rounded-lg border border-white/10" />
                          </div>
                       ) : (
                          <div className="text-sm md:text-base leading-relaxed break-words">
                             <MarkdownRenderer content={msg.text} />
                          </div>
                       )}
                       
                       <div className="text-[10px] text-slate-500 text-right mt-1 font-mono opacity-70">
                          {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                    </div>
                 </div>
               ))}
               
               {loadingState !== LoadingState.IDLE && (
                 <div className="flex justify-start animate-pulse">
                    <div className="bg-white/5 px-4 py-2 rounded-xl rounded-bl-none border border-white/5 flex items-center gap-2 text-sm text-slate-400">
                       <Loader2 className="w-4 h-4 animate-spin text-neon-blue" />
                       {loadingState === LoadingState.GENERATING_IMAGE ? 'Rasm chizilmoqda...' : 'Yozmoqda...'}
                    </div>
                 </div>
               )}
               <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </main>

        {/* Input Footer (Only visible in Chat) */}
        {activeView === 'chat' && (
           <footer className="shrink-0 p-3 md:p-4 bg-[#0a0a14]/90 backdrop-blur-lg border-t border-white/5 z-20">
              <div className="max-w-4xl mx-auto relative">
                 {/* Image Preview Overlay */}
                 {selectedImage && (
                    <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg border border-white/10 flex items-center gap-3 shadow-xl animate-slide-in">
                       <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="w-10 h-10 object-cover rounded bg-black" />
                       <span className="text-xs text-slate-300 pr-2">Rasm tanlandi</span>
                       <button onClick={() => setSelectedImage(undefined)} className="bg-white/10 p-1 rounded-full"><X className="w-3 h-3" /></button>
                    </div>
                 )}

                 <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 pl-2 transition-all focus-within:border-neon-blue/50 focus-within:bg-white/10">
                    <div className="flex flex-col gap-1 pb-1">
                       <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-lg ${selectedImage ? 'text-neon-blue bg-neon-blue/10' : 'text-slate-400 hover:text-white'}`}>
                          <ImageIcon className="w-5 h-5" />
                       </button>
                       <button onClick={() => setMode(mode === 'chat' ? 'generate-image' : 'chat')} className={`p-2 rounded-lg ${mode === 'generate-image' ? 'text-neon-purple bg-neon-purple/10' : 'text-slate-400 hover:text-white'}`}>
                          <Paintbrush className="w-5 h-5" />
                       </button>
                    </div>
                    
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder={mode === 'generate-image' ? "Rasm tasvirini yozing..." : "Xabar yozing..."}
                      className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 py-3 px-1 min-h-[48px] max-h-[120px] resize-none text-base"
                      rows={1}
                    />

                    <button 
                       onClick={handleSendMessage}
                       disabled={loadingState !== LoadingState.IDLE || (!inputValue.trim() && !selectedImage)}
                       className={`p-3 rounded-xl mb-0.5 transition-all ${
                          (inputValue.trim() || selectedImage) && loadingState === LoadingState.IDLE 
                          ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-lg' 
                          : 'bg-white/5 text-slate-600'
                       }`}
                    >
                       {loadingState !== LoadingState.IDLE ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
              </div>
           </footer>
        )}
      </div>
    </div>
  );
};

export default App;