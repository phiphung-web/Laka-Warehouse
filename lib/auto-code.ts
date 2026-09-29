import { normalize, sanitizeAreaPrefix, KIND_PREFIX_MAP } from "./inventory.ts";

export function allocateNextItemCode(existingCodes: Iterable<string>, prefix: string): string {
 const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
 const re = new RegExp(`^${escapedPrefix}(\\d+)$`);
 const usedNums = new Set<number>();
 for (const code of existingCodes) {
  const m = code.match(re);
  if (m) usedNums.add(parseInt(m[1], 10));
 }
 let seq = 1;
 while (usedNums.has(seq)) seq++;
 return `${prefix}${String(seq).padStart(4, "0")}`;
}

export const TAB_LOCATION_MAP: Record<string, string> = {
 NhapKho_Homestay: "HOMESTAY",
 NhapKho_BuongPhong: "BUONG_PHONG",
 NhapKho_Nhahang: "NHA_HANG",
 NhapKho_Cafe: "CAFE",
};

export const DAILY_AREA_MAP: Record<string, string> = {
 "buong phong": "BUONG_PHONG",
 "buong": "BUONG_PHONG",
 "bp": "BUONG_PHONG",
 "homestay": "HOMESTAY",
 "le tan": "HOMESTAY",
 "hs": "HOMESTAY",
 "lt": "HOMESTAY",
 "nha hang": "NHA_HANG",
 "nha hang ben ngoai": "NHA_HANG",
 "nh": "NHA_HANG",
 "cafe": "CAFE",
 "ca phe": "CAFE",
 "cf": "CAFE",
 "bep": "BEP",
 "kho tong": "KHO_TONG",
 "kt": "KHO_TONG",
 "dung chung": "DUNG_CHUNG",
 "dc": "DUNG_CHUNG",
};

export function resolveDailyArea(rawArea: string): string | null {
 if (!rawArea) return null;
 const key = normalize(rawArea.trim());
 return DAILY_AREA_MAP[key] ?? null;
}

export function canonicalJson(obj: any): string {
 if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
 if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
 const keys = Object.keys(obj).sort();
 return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}
