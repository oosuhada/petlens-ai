import { useEffect, useState } from "react";

export default function usePetLensLocale() {
  const [language, setLanguage] = useState("ko");

  useEffect(() => {
    const saved = window.localStorage.getItem("petlens-language");
    if (saved === "ko" || saved === "en") setLanguage(saved);
  }, []);

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("petlens-language", nextLanguage);
  };

  const isKo = language === "ko";
  const tr = (ko, en) => (isKo ? ko : en);

  return { language, isKo, tr, changeLanguage };
}
