import { Message, UserProfile, StoredUser } from '../types';

// Kalitlar (LocalStorage uchun)
const USERS_KEY = 'sevnex_users_db_v1';
const HISTORY_KEY_PREFIX = 'sevnex_history_';

class LocalDatabase {
  
  constructor() {
    // Tizim tayyor
  }

  // Yordamchi: Xotirani tozalash (boshqa userlar tarixini o'chirish)
  private pruneStorage(excludeKey: string) {
    try {
      const keysToRemove: string[] = [];
      for(let i=0; i<localStorage.length; i++) {
         const k = localStorage.key(i);
         // Faqat tarix kalitlarini qidiramiz va joriy userdan boshqasini o'chiramiz
         if(k && k.startsWith(HISTORY_KEY_PREFIX) && k !== excludeKey) {
             keysToRemove.push(k);
         }
      }
      
      if (keysToRemove.length > 0) {
        console.warn(`Xotira to'ldi. ${keysToRemove.length} ta eski tarix tozalanmoqda.`);
        keysToRemove.forEach(k => localStorage.removeItem(k));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Yordamchi: Foydalanuvchilarni olish
  private getUsers(): StoredUser[] {
    try {
      const usersStr = localStorage.getItem(USERS_KEY);
      return usersStr ? JSON.parse(usersStr) : [];
    } catch (e) {
      console.error("Database read error:", e);
      return [];
    }
  }

  // Yordamchi: Foydalanuvchilarni saqlash (Xavfsiz usul)
  private saveUsers(users: StoredUser[]) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e: any) {
      // Agar xotira to'lgan bo'lsa
      if (this.isQuotaError(e)) {
         console.warn("Userlarni saqlashda xotira to'ldi. Avatarlarni olib tashlab qayta urinilmoqda...");
         
         // Avatarlarni olib tashlab saqlashga urinish (faqat matn qoladi)
         const lightUsers = users.map(u => {
           const { avatar, ...rest } = u;
           return rest; // avatar maydonini olib tashlaymiz
         });

         try {
            localStorage.setItem(USERS_KEY, JSON.stringify(lightUsers as StoredUser[]));
         } catch (retryError) {
            console.error("Kritik xato: Userlarni saqlab bo'lmadi.", retryError);
            throw new Error("Xotira to'la. Iltimos, brauzer tarixini tozalang.");
         }
      } else {
        throw e;
      }
    }
  }

  private isQuotaError(e: any): boolean {
    return (
      e instanceof DOMException &&
      // Har xil brauzerlar uchun kodlar
      (e.code === 22 ||
       e.code === 1014 ||
       e.name === 'QuotaExceededError' ||
       e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
      (localStorage.length !== 0)
    );
  }

  async init(): Promise<boolean> {
    return true;
  }

  async createUser(user: StoredUser): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const users = this.getUsers();
    const cleanEmail = user.email.trim().toLowerCase();
    
    const exists = users.find(u => u.email.trim().toLowerCase() === cleanEmail);
    if (exists) {
      throw new Error("Bu email allaqachon ro'yxatdan o'tgan.");
    }

    const newUser: StoredUser = {
      ...user,
      email: cleanEmail,
      password: user.password.trim()
    };

    users.push(newUser);
    this.saveUsers(users);
  }

  async verifyUser(email: string, password: string): Promise<UserProfile | null> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const users = this.getUsers();
    const user = users.find(u => u.email.trim().toLowerCase() === cleanEmail);

    if (!user) return null;

    if (user.password === cleanPassword) {
      return {
        name: user.name,
        email: user.email,
        avatar: user.avatar
      };
    }

    return null;
  }

  async updateUser(email: string, updates: Partial<UserProfile>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.email.trim().toLowerCase() === cleanEmail);

    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates };
      this.saveUsers(users);
    } else {
      throw new Error("Foydalanuvchi topilmadi");
    }
  }

  // Tarixni saqlash (Eng muhim qism)
  async saveHistory(email: string, messages: Message[]): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const key = HISTORY_KEY_PREFIX + cleanEmail;

    // Yordamchi: Xabarlarni optimallashtirish
    const optimizeMessages = (msgs: Message[], limit: number) => {
      return msgs.slice(-limit).map(msg => {
        const cleanMsg = { ...msg };
        // Rasmlarni olib tashlaymiz (faqat matn qoladi)
        delete cleanMsg.attachment;
        delete cleanMsg.generatedImage;
        return cleanMsg;
      });
    };

    // 1-urinish: Oxirgi 30 ta xabar, rasmsiz
    let dataToSave = JSON.stringify(optimizeMessages(messages, 30));

    try {
      localStorage.setItem(key, dataToSave);
    } catch (e: any) {
      if (this.isQuotaError(e)) {
        
        // 2-urinish: Joy bo'shatish va qayta urinish
        this.pruneStorage(key);
        
        try {
           localStorage.setItem(key, dataToSave);
        } catch (retryE) {
           
           // 3-urinish: Juda qisqa tarix (faqat 10 ta)
           console.warn("Hali ham joy yo'q. Tarix qisqartirilmoqda.");
           dataToSave = JSON.stringify(optimizeMessages(messages, 10));
           
           try {
             // Kalitni o'chirib qayta yozish ba'zan yordam beradi
             localStorage.removeItem(key);
             localStorage.setItem(key, dataToSave);
           } catch (finalE) {
             console.error("Afsuski, tarixni saqlab bo'lmadi. Xotira to'liq.");
           }
        }
      }
    }
  }

  async getHistory(email: string): Promise<Message[]> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const historyStr = localStorage.getItem(HISTORY_KEY_PREFIX + cleanEmail);
      if (!historyStr) return [];

      const parsed = JSON.parse(historyStr);
      return parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (e) {
      console.error("History load error", e);
      return [];
    }
  }
}

export const db = new LocalDatabase();