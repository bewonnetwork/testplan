{
  incomeCapMultiplierAll: 3,      // 3/4/5 এখান থেকে বদলাবে
  capExcludeTypes: ["roi"],       // ROI cap-এর বাইরে রাখতে চাইলে

  blockFreeIdIncome: true,        // free ID-তে income বন্ধ
  allowSponsorOnFreeId: false,    // free ID-তে sponsor চাইলে true (তুমি বলেছ বন্ধ)

  sponsorPercent: 5,
  roiPercentPerDay: 1.2
}
// config.js
export const APP_MODE = {
  USE_LOCAL: true,        // ✅ true = Local Demo, false = Live Firestore
  ROOT_USERNAME: "@love", // ✅ genealogy top node (যাকে top দেখাবে)
  DAILY_CAP: 100,         // ✅ binary capping/day (demo)
  BINARY_PERCENT: 0.10,   // ✅ 10%
  PAIR_VALUE: 1           // ✅ 1 pair = 1 USDT
};