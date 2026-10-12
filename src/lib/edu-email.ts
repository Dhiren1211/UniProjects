// ============================================================
// Education-email gate — shared by client (live field feedback)
// and server (request-code + register enforcement).
// Accepts: *.edu, *.edu.xx, *.ac.xx, *.ac.xx.yy and a small
// allowlist for known university domains that fit neither pattern.
// ============================================================

const EDU_DOMAIN_ALLOWLIST = new Set([
  "ks.ac.kr",
  "kyungsung.ac.kr",
]);

export function isEducationEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(value)) return false;
  const domain = value.slice(value.lastIndexOf("@") + 1);
  if (EDU_DOMAIN_ALLOWLIST.has(domain)) return true;
  // mit.edu / uni.edu.tw / anything ending in a .edu TLD chain
  if (/(^|\.)(edu|ac)(\.[a-z]{2,})+$/.test(domain)) return true;
  return false;
}

export const EDU_EMAIL_HINT = "Only education emails can register — use your university address (e.g. jane.doe@student.ks.ac.kr).";
