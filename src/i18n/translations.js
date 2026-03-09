/**
 * i18n Translation Dictionary
 * ─────────────────────────────────────────────────
 * Thai-first site with English as secondary language.
 * Default locale: 'th'
 *
 * Usage:
 *   import { t, defaultLocale } from '../i18n/translations.js';
 *   const label = t.th.readMore; // "อ่านเพิ่มเติม"
 */

export const defaultLocale = 'th';
export const locales = ['th', 'en'];

export const t = {
    th: {
        // Navigation
        home: 'หน้าหลัก',
        blog: 'บทความ',
        about: 'เกี่ยวกับ',
        searchPlaceholder: 'ค้นหาบทความ หัวข้อ คำสำคัญ…',
        searchArticles: 'ค้นหาบทความ…',
        startTyping: 'พิมพ์เพื่อค้นหาบทความ',
        navigate: 'เลื่อน',
        open: 'เปิด',
        close: 'ปิด',
        noResults: 'ไม่พบบทความ',
        tryDifferent: 'ลองใช้คำค้นหาอื่น',

        // Hero
        latestArticle: 'บทความล่าสุด',
        readArticle: 'อ่านบทความ',

        // Sections
        allArticles: 'บทความทั้งหมด',
        editorsPicks: 'บทความแนะนำ',
        latestArticles: 'บทความใหม่',
        moreToExplore: 'บทความเพิ่มเติม',
        viewAll: 'ดูทั้งหมด →',
        browseAll: 'ดูบทความทั้งหมด',
        viewAllArticles: 'ดูบทความทั้งหมด',
        read: 'อ่าน →',

        // About
        aboutDrTim: 'เกี่ยวกับ หมอทิม',
        functionalMedicine: 'Functional Medicine',
        metabolicHealth: '& Metabolic Health',
        expert: 'ผู้เชี่ยวชาญ',
        aboutDescription: 'แพทย์ผู้เชี่ยวชาญด้าน Functional Medicine ที่ Ultramed Clinic ชลบุรี มุ่งเน้นการรักษาแบบ root-cause สำหรับสุขภาพเมตาบอลิก การจัดการเบาหวาน และ longevity',
        metabolicHealthLabel: 'สุขภาพเมตาบอลิก',
        longevityScience: 'วิทยาศาสตร์อายุยืน',
        rootCauseDiagnosis: 'วินิจฉัยต้นเหตุ',
        articlesPublished: 'บทความที่เผยแพร่',
        healthTopics: 'หัวข้อสุขภาพ',
        credential: 'คุณวุฒิ',
        follow: 'ติดตาม',

        // Blog index
        healthBlog: 'บทความสุขภาพ',
        blogSubtitle: 'บทความเกี่ยวกับ Functional Medicine สุขภาพเมตาบอลิก และ Longevity โดยหมอทิม',
        all: 'ทั้งหมด',

        // Blog post
        relatedPosts: 'บทความที่เกี่ยวข้อง',
        tags: 'แท็ก',
        shareArticle: 'แชร์บทความ',
        breadcrumbHome: 'หน้าหลัก',
        breadcrumbBlog: 'บทความ',

        // AEO
        quickAnswer: 'คำตอบด่วน',
        whoIsDrTim: 'หมอทิมคือใคร?',
        drTimAnswer: 'หมอทิม เป็นแพทย์ผู้เชี่ยวชาญด้าน Functional Medicine ที่ Ultramed Clinic ชลบุรี ประเทศไทย มุ่งเน้นดูแลสุขภาพเมตาบอลิก การดูแลสุขภาพแบบองค์รวม และการดูแลสุขภาพเพื่อความยืนยาว ช่วยให้ผู้ป่วยปรับปรุงสุขภาพผ่านการวินิจฉัยและรักษาแบบหาต้นเหตุ',

        // Meta
        siteTitle: 'Functional Medicine & สุขภาพเมตาบอลิก',
        siteDescription: 'หมอทิม — แพทย์ผู้เชี่ยวชาญด้าน Functional Medicine สุขภาพเมตาบอลิก และ Longevity ที่ Ultramed Clinic ชลบุรี',
    },

    en: {
        // Navigation
        home: 'Home',
        blog: 'Blog',
        about: 'About',
        searchPlaceholder: 'Search articles, topics, keywords…',
        searchArticles: 'Search articles…',
        startTyping: 'Start typing to find articles',
        navigate: 'Navigate',
        open: 'Open',
        close: 'Close',
        noResults: 'No articles found',
        tryDifferent: 'Try different keywords',

        // Hero
        latestArticle: 'Latest Article',
        readArticle: 'Read Article',

        // Sections
        allArticles: 'All Articles',
        editorsPicks: "Editor's Picks",
        latestArticles: 'Latest Articles',
        moreToExplore: 'More to Explore',
        viewAll: 'View all articles →',
        browseAll: 'Browse all →',
        viewAllArticles: 'View All Articles',
        read: 'Read →',

        // About
        aboutDrTim: 'About Dr. Tim',
        functionalMedicine: 'Functional Medicine',
        metabolicHealth: '& Metabolic Health',
        expert: 'Expert',
        aboutDescription: 'A medical doctor (MD) specializing in Functional Medicine at Ultramed Clinic, Chonburi, Thailand. Focused on evidence-based root-cause treatment for metabolic health, diabetes management, and longevity.',
        metabolicHealthLabel: 'Metabolic Health',
        longevityScience: 'Longevity Science',
        rootCauseDiagnosis: 'Root-Cause Diagnosis',
        articlesPublished: 'Articles Published',
        healthTopics: 'Health Topics',
        credential: 'Credential',
        follow: 'Follow',

        // Blog index
        healthBlog: 'Health & Medicine Blog',
        blogSubtitle: 'Evidence-based articles on functional medicine, metabolic health, and longevity by Dr. Tim.',
        all: 'All',

        // Blog post
        relatedPosts: 'Related Posts',
        tags: 'Tags',
        shareArticle: 'Share Article',
        breadcrumbHome: 'Home',
        breadcrumbBlog: 'Blog',

        // AEO
        quickAnswer: 'Quick Answer',
        whoIsDrTim: 'Who is Dr. Tim?',
        drTimAnswer: 'Dr. Tim is a medical doctor specializing in Functional Medicine at Ultramed Clinic Chonburi, Thailand. He focuses on evidence-based metabolic health, longevity, and wellness, helping patients optimize their health through personalized root-cause diagnosis and treatment approaches.',

        // Meta
        siteTitle: 'Functional Medicine & Metabolic Health',
        siteDescription: 'Dr. Tim — MD specializing in Functional Medicine, metabolic health, and evidence-based longevity at Ultramed Clinic Chonburi.',
    },
};

/**
 * Get translations for a locale.
 * Falls back to Thai if the locale is not found.
 * @param {string} locale
 * @returns {object}
 */
export function getTranslations(locale = 'th') {
    return t[locale] || t.th;
}
