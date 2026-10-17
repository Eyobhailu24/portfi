export const plans = [
  { id: "free", name: "Free", portfolios: 1, pages: 3, storageMB: 100, historyDays: 0, description: "A good place to begin.", features: ["1 portfolio, up to 3 pages", "Starter templates & essential motion", "GitHub & Vercel publishing", "Download your source code"], footerCredit: true },
  { id: "creator", name: "Creator", portfolios: 3, pages: 10, storageMB: 1024, historyDays: 30, description: "More room to make it yours.", features: ["3 portfolios, up to 10 pages each", "Every template & standard animation", "Advanced design & device controls", "30-day version history", "Optional Portfi credit"], footerCredit: false },
  { id: "pro", name: "Pro", portfolios: 10, pages: 30, storageMB: 5120, historyDays: 90, description: "For your growing body of work.", features: ["10 portfolios, up to 30 pages each", "Everything in Creator", "Reusable sections & themes", "Advanced motion presets", "90-day version history"], footerCredit: false },
] as const;

