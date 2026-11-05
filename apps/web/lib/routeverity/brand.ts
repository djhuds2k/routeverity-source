export const brand = {
  name: "RouteVerity",
  legalName: "Multitouch Displays Ltd.",
  contactEmail: "contact@routeverity.com",
  tagline: "Transparent click tracking.",
  description: "Marketing attribution you can verify.",
  certificationStatus: "NOT_SUBMITTED" as
    | "NOT_SUBMITTED"
    | "PREPARING"
    | "SUBMITTED"
    | "CERTIFIED"
    | "SUSPENDED",
  logo: "/brand/logo.png",
  wordmark: "/brand/wordmark.png",
  navigation: [
    { slug: "", label: "Overview", enabled: true },
    { slug: "campaigns", label: "Campaigns", enabled: true },
    { slug: "links", label: "Links", enabled: true },
    { slug: "conversions", label: "Conversions", enabled: true },
    { slug: "analytics", label: "Analytics", enabled: true },
    { slug: "domains", label: "Domains", enabled: true },
    { slug: "api", label: "API & Webhooks", enabled: false },
    { slug: "settings", label: "Settings", enabled: true },
  ],
} as const;
