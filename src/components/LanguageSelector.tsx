import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supportedLanguages, type SupportedLanguage } from '../i18n';

const languageFlags: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  pt: '🇧🇷',
  ko: '🇰🇷',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ru: '🇷🇺',
  de: '🇩🇪',
};

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const currentLang = (supportedLanguages.includes(i18n.language as SupportedLanguage)
    ? i18n.language
    : 'en') as SupportedLanguage;

  return (
    <Select value={currentLang} onValueChange={(val) => i18n.changeLanguage(val)}>
      <SelectTrigger className="w-[52px] bg-accent/50 border-0 shadow-sm px-2 hidden md:inline-flex">
        <Globe className="h-4 w-4 shrink-0" />
      </SelectTrigger>
      <SelectContent>
        {supportedLanguages.map((lang) => (
          <SelectItem key={lang} value={lang}>
            <span className="flex items-center gap-2">
              <span>{languageFlags[lang]}</span>
              <span>{t(`language.${lang}`)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
