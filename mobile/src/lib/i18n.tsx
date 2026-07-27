import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

export type Language = "en" | "te" | "hi";

export interface Translations {
  // Common Navigation & Headers
  homeTab: string;
  myNeedsTab: string;
  activityTab: string;
  profileTab: string;
  forumTab: string;
  liveNeedsHeader: string;
  
  // Actions
  postANeed: string;
  donate: string;
  iCanDonate: string;
  bookSlot: string;
  claimItem: string;
  volunteerPledge: string;
  shareOnWhatsApp: string;
  submit: string;
  cancel: string;
  tryAgain: string;
  completeProfile: string;

  // Need Types
  moneyNeed: string;
  kitNeed: string;
  bloodNeed: string;
  mealSlotNeed: string;
  goodsNeed: string;
  volunteerNeed: string;

  // Urgencies & Statuses
  normalUrgency: string;
  urgentUrgency: string;
  emergencyUrgency: string;
  statusLive: string;
  statusFulfilled: string;
  statusPartiallyFulfilled: string;

  // Settings & Profile
  selectLanguage: string;
  english: string;
  telugu: string;
  hindi: string;
  availableToDonate: string;
  trustTier: string;
}

const en: Translations = {
  homeTab: "Home",
  myNeedsTab: "My Needs",
  activityTab: "Activity",
  profileTab: "Profile",
  forumTab: "Forum",
  liveNeedsHeader: "Live needs",

  postANeed: "+ Post a need",
  donate: "Donate Now",
  iCanDonate: "I Can Donate",
  bookSlot: "Book Meal Slot",
  claimItem: "Claim This Item",
  volunteerPledge: "Volunteer My Time",
  shareOnWhatsApp: "Share on WhatsApp",
  submit: "Submit",
  cancel: "Cancel",
  tryAgain: "Try again",
  completeProfile: "Complete Profile",

  moneyNeed: "Money",
  kitNeed: "Kit",
  bloodNeed: "Blood",
  mealSlotNeed: "Meal Slot",
  goodsNeed: "Goods",
  volunteerNeed: "Volunteer",

  normalUrgency: "Normal",
  urgentUrgency: "Urgent",
  emergencyUrgency: "Emergency",
  statusLive: "LIVE",
  statusFulfilled: "FULFILLED",
  statusPartiallyFulfilled: "PARTIALLY FULFILLED",

  selectLanguage: "Preferred Language / భాష / भाषा",
  english: "English",
  telugu: "తెలుగు (Telugu)",
  hindi: "हिन्दी (Hindi)",
  availableToDonate: "Available for Emergency Blood Donation",
  trustTier: "Trust Tier",
};

const te: Translations = {
  homeTab: "హోమ్",
  myNeedsTab: "నా అవసరాలు",
  activityTab: "కార్యాచరణ",
  profileTab: "ప్రొఫైల్",
  forumTab: "ఫోరమ్",
  liveNeedsHeader: "ప్రస్తుత అవసరాలు",

  postANeed: "+ సాయం కోరండి",
  donate: "విరాళం ఇవ్వండి",
  iCanDonate: "నేను రక్తం ఇస్తాను",
  bookSlot: "భోజనం స్లాట్ బుక్ చేయండి",
  claimItem: "ఈ వస్తువును ఇవ్వండి",
  volunteerPledge: "వాలంటీర్‌గా చేరండి",
  shareOnWhatsApp: "వాట్సాప్‌లో షేర్ చేయండి",
  submit: "సమర్పించండి",
  cancel: "రద్దు చేయండి",
  tryAgain: "మళ్ళీ ప్రయత్నించండి",
  completeProfile: "ప్రొఫైల్ పూర్తి చేయండి",

  moneyNeed: "ఆర్థిక సాయం",
  kitNeed: "కిట్ (సామాగ్రి)",
  bloodNeed: "రక్తం",
  mealSlotNeed: "భోజనం స్లాట్",
  goodsNeed: "వస్తువులు",
  volunteerNeed: "వాలంటీర్",

  normalUrgency: "సాధారణం",
  urgentUrgency: "అత్యవసరం",
  emergencyUrgency: "ఎమర్జెన్సీ",
  statusLive: "ప్రస్తుతం",
  statusFulfilled: "పూర్తయింది",
  statusPartiallyFulfilled: "పాక్షికంగా పూర్తయింది",

  selectLanguage: "భాషను ఎంచుకోండి / Preferred Language",
  english: "English",
  telugu: "తెలుగు (Telugu)",
  hindi: "हिन्दी (Hindi)",
  availableToDonate: "అత్యవసర రక్తదానానికి సిద్ధంగా ఉన్నాను",
  trustTier: "నమ్మకమైన స్థాయి (Trust Tier)",
};

const hi: Translations = {
  homeTab: "होम",
  myNeedsTab: "मेरी आवश्यकताएं",
  activityTab: "गतिविधि",
  profileTab: "प्रोफाइल",
  forumTab: "फोरम",
  liveNeedsHeader: "सक्रिय आवश्यकताएं",

  postANeed: "+ सहायता पोस्ट करें",
  donate: "दान करें",
  iCanDonate: "मैं रक्तदान कर सकता हूं",
  bookSlot: "भोजन स्लॉट बुक करें",
  claimItem: "यह वस्तु प्रदान करें",
  volunteerPledge: "स्वयंसेवक बनें",
  shareOnWhatsApp: "व्हाट्सएप पर शेयर करें",
  submit: "जमा करें",
  cancel: "रद्द करें",
  tryAgain: "पुनः प्रयास करें",
  completeProfile: "प्रोफाइल पूरा करें",

  moneyNeed: "आर्थिक सहायता",
  kitNeed: "किट (सामग्री)",
  bloodNeed: "रक्तदान",
  mealSlotNeed: "भोजन स्लॉट",
  goodsNeed: "वस्तुएं",
  volunteerNeed: "स्वयंसेवक",

  normalUrgency: "सामान्य",
  urgentUrgency: "अत्यावश्यक",
  emergencyUrgency: "आपातकालीन",
  statusLive: "सक्रिय",
  statusFulfilled: "पूर्ण हुआ",
  statusPartiallyFulfilled: "आंशिक रूप से पूर्ण",

  selectLanguage: "भाषा चुनें / Preferred Language",
  english: "English",
  telugu: "తెలుగు (Telugu)",
  hindi: "हिन्दी (Hindi)",
  availableToDonate: "आपातकालीन रक्तदान के लिए उपलब्ध",
  trustTier: "विश्वसनीयता स्तर (Trust Tier)",
};

const translations: Record<Language, Translations> = { en, te, hi };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

const STORAGE_KEY = "user_language_preference";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // The choice was previously in-memory only — STORAGE_KEY was declared and never used, so
  // every app restart silently reverted to English. A language preference that doesn't survive
  // a restart reads as a broken toggle, which is exactly how this was reported.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "te" || saved === "hi") setLanguageState(saved);
      })
      .catch(() => {});
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    // Fire-and-forget: the UI must switch instantly, and a failed write is not worth blocking
    // or surfacing — worst case the preference doesn't survive the next restart.
    SecureStore.setItemAsync(STORAGE_KEY, lang).catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
