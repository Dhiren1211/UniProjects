/**
 * The official Kyungsung University department catalogue, scraped from
 * https://kscms.ks.ac.kr (단과대학 pages, e.g. mCode=MN075) + the 교학팀
 * contact table (mCode=MN180). Shared by prisma/seed.ts and the Task-32
 * one-off migration (migrate-ks-departments.ts).
 *
 * - The six original seed codes are kept so existing project/user references
 *   survive: CSE 컴퓨터공학과 · ECE 전자공학과 · MRE 메카트로닉스공학과 ·
 *   BUS 경영학과 · DSC 빅데이터응용통계학과 · DME 미디어콘텐츠학과.
 * - Every other official 학부/학과 is listed with its published homepage link
 *   where one exists (admins can edit links + the capstone term any time).
 * - capstoneLabel defaults to "Capstone Design" - Global IT's term (default faculty).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export type DeptSeed = {
  code: string;
  name: string;
  ko: string;
  college: string;
  website?: string;
};

const ACCENTS = ["teal", "sky", "orange", "rose", "lime", "violet"] as const;
let accentCursor = 0;
const nextAccent = () => ACCENTS[accentCursor++ % ACCENTS.length];

const renames: DeptSeed[] = [
  { code: "CSE", name: "Computer Engineering", ko: "컴퓨터공학과", college: "College of Engineering", website: "http://kscms.ks.ac.kr/computer/" },
  { code: "ECE", name: "Electronic Engineering", ko: "전자공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/electronics/" },
  { code: "MRE", name: "Mechatronics Engineering", ko: "메카트로닉스공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/me" },
  { code: "BUS", name: "Business Administration", ko: "경영학과", college: "College of Business & Economics", website: "http://kscms.ks.ac.kr/business/" },
  { code: "DSC", name: "Big Data & Applied Statistics", ko: "빅데이터응용통계학과", college: "College of Business & Economics", website: "https://kscms.ks.ac.kr/kstat/" },
  { code: "DME", name: "Media Contents", ko: "미디어콘텐츠학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/media" },
];

// ---- official catalogue (kor names + published homepage links) ----
const created: DeptSeed[] = [
  // Global College - the English-track home of the showcase ("default Global IT")
  { code: "GITE", name: "Global IT Engineering", ko: "글로벌IT공학부", college: "Global College", website: "https://ksgc.kr" },
  { code: "GS", name: "Global Studies", ko: "글로벌학부", college: "Global College", website: "https://ksgc.kr" },

  // College of Engineering - 공과대학
  { code: "MAE", name: "Mechanical & Automotive Engineering", ko: "기계자동차공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/engcar" },
  { code: "EE", name: "Electrical Engineering", ko: "전기공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/electric/" },
  { code: "CS", name: "Computer Science", ko: "소프트웨어학과", college: "College of Engineering", website: "http://kscms.ks.ac.kr/software/" },
  { code: "ICE", name: "Information & Communication Engineering", ko: "정보통신공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/ince/" },
  { code: "AME", name: "Advanced Materials & Energy Engineering", ko: "신소재에너지공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/ane/Main.do" },
  { code: "CHE", name: "Chemical Engineering", ko: "화학공학과", college: "College of Engineering", website: "http://kscms.ks.ac.kr/chem/" },
  { code: "IME", name: "Industrial & Management Engineering", ko: "산업경영공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/inme/" },
  { code: "ENV", name: "Environmental Engineering", ko: "환경공학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/environ/" },
  { code: "CE", name: "Civil Engineering", ko: "토목공학과", college: "College of Engineering", website: "http://kscms.ks.ac.kr/civil/" },
  { code: "URBAN", name: "Urban Engineering", ko: "도시계획학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/urban/" },
  { code: "ARCH", name: "Architecture", ko: "건축학과", college: "College of Engineering", website: "http://kscms.ks.ac.kr/archi/" },
  { code: "IARCH", name: "Interior Architecture", ko: "실내건축학과", college: "College of Engineering", website: "https://kscms.ks.ac.kr/interior/" },

  // College of Business & Economics - 상경대학
  { code: "EFL", name: "Economics, Finance & Logistics", ko: "경제금융물류학부", college: "College of Business & Economics", website: "http://kscms.ks.ac.kr/efl/" },
  { code: "HTM", name: "Hospitality & Tourism Management", ko: "호텔관광외식경영학부", college: "College of Business & Economics", website: "https://kscms.ks.ac.kr/htm/Main.do" },
  { code: "TRADE", name: "International Trade & Commerce", ko: "국제무역통상학과", college: "College of Business & Economics", website: "https://kscms.ks.ac.kr/trade/Main.do" },
  { code: "ACCT", name: "Accounting", ko: "회계학과", college: "College of Business & Economics", website: "http://kscms.ks.ac.kr/accounting/" },

  // College of Humanities & Social Sciences - 인문사회대학
  { code: "HUM", name: "Humanities", ko: "인문문화학부", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/klnl/" },
  { code: "GLOC", name: "Glocal Cultural Studies", ko: "글로컬문화학부", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/gloculture/" },
  { code: "ENGL", name: "English Language & Literature", ko: "영어영문학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/elnl/" },
  { code: "CHIN", name: "Chinese Studies", ko: "중국학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/china/" },
  { code: "LIS", name: "Library & Information Science", ko: "문헌정보학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/lnis/" },
  { code: "ECD", name: "Early Childhood Education", ko: "유아교육과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/ecu/" },
  { code: "ETH", name: "Ethics Education", ko: "윤리교육과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/ethics/" },
  { code: "PSY", name: "Psychology", ko: "심리학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/psycho/" },
  { code: "EDUC", name: "Education", ko: "교육학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/edu/Main.do" },
  { code: "LAW", name: "Law", ko: "법학과", college: "College of Humanities & Social Sciences" },
  { code: "POL", name: "Police Administration", ko: "경찰행정학과", college: "College of Humanities & Social Sciences" },
  { code: "COMM", name: "Media Communication", ko: "미디어커뮤니케이션학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/masscomm/" },
  { code: "ADV", name: "Advertising & Public Relations", ko: "광고홍보학과", college: "College of Humanities & Social Sciences", website: "https://kscms.ks.ac.kr/pa/" },
  { code: "SW", name: "Social Welfare", ko: "사회복지학과", college: "College of Humanities & Social Sciences", website: "http://kscms.ks.ac.kr/sw/" },

  // College of Pharmacy - 약학대학
  { code: "PHARM", name: "Pharmacy", ko: "약학과", college: "College of Pharmacy", website: "https://kscms.ks.ac.kr/pharmacy/Main.do" },

  // College of Arts - 예술종합대학
  { code: "MUSIC", name: "Music", ko: "음악학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/music/" },
  { code: "VD", name: "Visual Communication Design", ko: "시각디자인학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/vdesign/" },
  { code: "ID", name: "Industrial Design", ko: "산업디자인학과", college: "College of Arts", website: "http://kscms.ks.ac.kr/ksid/" },
  { code: "THEA", name: "Theatre & Film", ko: "연극영화학부", college: "College of Arts", website: "http://kscms.ks.ac.kr/act/" },
  { code: "SA", name: "Screen Arts", ko: "영상애니메이션학부", college: "College of Arts", website: "http://kscms.ks.ac.kr/sarts/" },
  { code: "SPOH", name: "Sport & Health Science", ko: "스포츠건강학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/snb" },
  { code: "CA", name: "Contemporary Art", ko: "현대미술학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/fa/" },
  { code: "CRAFT", name: "Craft Design", ko: "공예디자인학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/craft/Main.do" },
  { code: "PHOTO", name: "Photography", ko: "사진학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/photography/" },
  { code: "FDM", name: "Fashion Design & Merchandising", ko: "패션디자인학과", college: "College of Arts", website: "http://kscms.ks.ac.kr/fdnm/" },
  { code: "DANCE", name: "Dance", ko: "무용학과", college: "College of Arts", website: "https://kscms.ks.ac.kr/dance/" },

  // College of Health & Life Sciences - 생명보건대학
  { code: "NURS", name: "Nursing Science", ko: "간호학과", college: "College of Health & Life Sciences", website: "http://kscms.ks.ac.kr/ns/Main.do" },
  { code: "PT", name: "Physical Therapy", ko: "물리치료학과", college: "College of Health & Life Sciences", website: "https://kscms.ks.ac.kr/pt/" },
  { code: "FSBT", name: "Food Science & Biotechnology", ko: "식품생명공학과", college: "College of Health & Life Sciences", website: "http://kscms.ks.ac.kr/fsnb/" },
  { code: "FNUT", name: "Food and Nutrition", ko: "식품영양학과", college: "College of Health & Life Sciences", website: "http://kscms.ks.ac.kr/nnhc/" },
  { code: "CAS", name: "Companion Animal Science", ko: "반려생물학과", college: "College of Health & Life Sciences", website: "https://kscms.ks.ac.kr/pet" },
  { code: "COSM", name: "Cosmetic Science", ko: "화장품학과", college: "College of Health & Life Sciences", website: "https://kscms.ks.ac.kr/csm" },
  { code: "SBI", name: "Smart Bio", ko: "스마트바이오학과", college: "College of Health & Life Sciences", website: "https://kscms.ks.ac.kr/biosafe" },
  { code: "PE", name: "Pharmaceutical Engineering", ko: "제약공학과", college: "College of Health & Life Sciences", website: "http://kscms.ks.ac.kr/medieng/" },

  // Industry–Innovation Convergence College - 산학혁신융합대학
  { code: "AIM", name: "AI Media", ko: "AI미디어학과", college: "Industry–Innovation Convergence College", website: "https://kscms.ks.ac.kr/aimedia" },
  { code: "AMS", name: "AI Mathematical Sciences", ko: "AI수리학과", college: "Industry–Innovation Convergence College", website: "http://kscms.ks.ac.kr/math/" },
  { code: "ENE", name: "Energy Science", ko: "에너지과학과", college: "Industry–Innovation Convergence College", website: "https://kscms.ks.ac.kr/sf/Main.do" },
  { code: "THEO", name: "Theology", ko: "신학과", college: "Industry–Innovation Convergence College" },
];


/** Pure rows for prisma/seed.ts - accent + sort order assigned, capstone term defaulted. */
export const departmentRows = [...renames, ...created].map((d, i) => ({
  name: d.name,
  code: d.code,
  tagline: `${d.ko} · ${d.college}`,
  website: d.website ?? null,
  capstoneLabel: "Capstone Design",
  accent: ACCENTS[i % ACCENTS.length],
  sortOrder: i + 1,
}));

/** Apply the catalogue to the database (rename-in-place for the six seed codes). */
export async function syncDepartments() {
  let order = 1;
  for (const d of [...renames, ...created]) {
    const data = {
      name: d.name,
      tagline: `${d.ko} · ${d.college}`,
      website: d.website ?? null,
      capstoneLabel: "Capstone Design" as string,
      accent: nextAccent(),
      sortOrder: order++,
    };
    const existing = await db.department.findUnique({ where: { code: d.code } });
    if (existing) {
      await db.department.update({ where: { code: d.code }, data });
      console.log(`≈ renamed ${d.code} → ${d.name} (${d.ko})`);
    } else {
      await db.department.create({ data: { code: d.code, ...data } });
      console.log(`+ created ${d.code} ${d.name} (${d.ko})`);
    }
  }
  const total = await db.department.count();
  console.log(`✓ done - ${total} departments in the catalogue`);
}
