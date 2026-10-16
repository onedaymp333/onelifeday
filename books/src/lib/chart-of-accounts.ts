/**
 * The chart of accounts, built for an entertainment freelancer and mapped to
 * the IRS Schedule C lines. This TypeScript file is the single source of truth.
 * The app reads it to show categories, and the first time setup uses it to seed
 * your books in the database.
 *
 * You never have to see account codes or debits and credits. They live here so
 * the ledger underneath stays correct and your tax summary lands on the right
 * line.
 */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense";

export interface AccountTemplate {
  code: string;
  name: string;
  type: AccountType;
  /** A finer grouping the app uses for matching and reports. */
  subtype?: string;
  /** The Schedule C line this category rolls up to, when it has one. */
  scheduleCLine?: string;
  /** A short plain note, shown in the UI where helpful. */
  note?: string;
}

/** Accounts the ledger needs behind the scenes, shared by every entity. */
const CORE_ACCOUNTS: AccountTemplate[] = [
  // Assets
  { code: "1000", name: "Checking", type: "asset", subtype: "bank" },
  { code: "1010", name: "Savings", type: "asset", subtype: "bank" },
  {
    code: "1100",
    name: "Unpaid invoices",
    type: "asset",
    subtype: "accounts_receivable",
    note: "Money clients owe you but have not paid yet.",
  },
  {
    code: "1200",
    name: "Zelle holding",
    type: "asset",
    subtype: "clearing",
    note: "Holds a payment until it is matched to a bank deposit.",
  },
  { code: "1210", name: "Venmo holding", type: "asset", subtype: "clearing" },
  { code: "1220", name: "PayPal holding", type: "asset", subtype: "clearing" },
  { code: "1230", name: "Stripe holding", type: "asset", subtype: "clearing" },
  { code: "1240", name: "Cash on hand", type: "asset", subtype: "cash" },
  // Liabilities
  {
    code: "2000",
    name: "Credit card",
    type: "liability",
    subtype: "credit_card",
  },
  {
    code: "2100",
    name: "Upcoming bills",
    type: "liability",
    subtype: "accounts_payable",
    note: "Bills you owe but have not paid yet.",
  },
  // Equity
  { code: "3000", name: "Owner equity", type: "equity", subtype: "owner_equity" },
  {
    code: "3100",
    name: "Owner draws",
    type: "equity",
    subtype: "owner_draw",
    note: "Money you take out for yourself. Classified on purpose, never guessed.",
  },
  {
    code: "3200",
    name: "Owner money in",
    type: "equity",
    subtype: "owner_contribution",
    note: "Your own money you put into the business.",
  },
];

/** Income categories. All roll up to Schedule C Line 1, tracked by source. */
const BUSINESS_INCOME: AccountTemplate[] = [
  { code: "4000", name: "Weddings", type: "income", scheduleCLine: "1" },
  { code: "4010", name: "Corporate events", type: "income", scheduleCLine: "1" },
  { code: "4020", name: "Club residencies", type: "income", scheduleCLine: "1" },
  { code: "4030", name: "MC hosting", type: "income", scheduleCLine: "1" },
  {
    code: "4040",
    name: "Production packages",
    type: "income",
    scheduleCLine: "1",
  },
  { code: "4050", name: "Media and content", type: "income", scheduleCLine: "1" },
  { code: "4060", name: "Tips", type: "income", scheduleCLine: "1" },
  {
    code: "4070",
    name: "Grants",
    type: "income",
    scheduleCLine: "1",
    note: "Some grants are taxed differently. Flagged for review.",
  },
];

/** Expense categories, each mapped to its Schedule C line. */
const BUSINESS_EXPENSES: AccountTemplate[] = [
  {
    code: "6100",
    name: "Marketing and advertising",
    type: "expense",
    scheduleCLine: "8",
  },
  {
    code: "6110",
    name: "Mileage",
    type: "expense",
    scheduleCLine: "9",
    note: "Tracked by the standard mileage rate for the year.",
  },
  { code: "6115", name: "Parking and tolls", type: "expense", scheduleCLine: "9" },
  {
    code: "6120",
    name: "Subcontractors: DJs, musicians, engineers",
    type: "expense",
    scheduleCLine: "11",
    note: "Watch for 1099 NEC when you pay someone 600 or more in a year.",
  },
  {
    code: "6130",
    name: "Equipment and gear",
    type: "expense",
    scheduleCLine: "13",
    note: "Large purchases may be written off over time or at once.",
  },
  { code: "6140", name: "Insurance", type: "expense", scheduleCLine: "15" },
  {
    code: "6150",
    name: "Legal and professional",
    type: "expense",
    scheduleCLine: "17",
  },
  {
    code: "6160",
    name: "Staging and sound rentals",
    type: "expense",
    scheduleCLine: "20a",
  },
  { code: "6170", name: "Venue fees", type: "expense", scheduleCLine: "20b" },
  {
    code: "6175",
    name: "Storage and warehouse",
    type: "expense",
    scheduleCLine: "20b",
  },
  {
    code: "6180",
    name: "Gear repair and maintenance",
    type: "expense",
    scheduleCLine: "21",
  },
  {
    code: "6190",
    name: "Supplies: cables and small gear",
    type: "expense",
    scheduleCLine: "22",
  },
  {
    code: "6200",
    name: "Licenses and permits",
    type: "expense",
    scheduleCLine: "23",
  },
  { code: "6210", name: "Travel", type: "expense", scheduleCLine: "24a" },
  {
    code: "6220",
    name: "Meals",
    type: "expense",
    scheduleCLine: "24b",
    note: "Usually 50 percent deductible.",
  },
  {
    code: "6230",
    name: "Phone and internet",
    type: "expense",
    scheduleCLine: "25",
    note: "Only the business share counts.",
  },
  {
    code: "6300",
    name: "Music licensing and pools",
    type: "expense",
    scheduleCLine: "27a",
  },
  {
    code: "6310",
    name: "Software and subscriptions",
    type: "expense",
    scheduleCLine: "27a",
  },
  {
    code: "6320",
    name: "Bank and payment fees",
    type: "expense",
    scheduleCLine: "27a",
  },
];

/** A lighter set for the Personal books, kept separate from the business. */
const PERSONAL_INCOME: AccountTemplate[] = [
  { code: "4900", name: "Personal income", type: "income" },
];

const PERSONAL_EXPENSES: AccountTemplate[] = [
  { code: "6900", name: "Personal spending", type: "expense" },
];

export const businessChartOfAccounts: AccountTemplate[] = [
  ...CORE_ACCOUNTS,
  ...BUSINESS_INCOME,
  ...BUSINESS_EXPENSES,
];

export const personalChartOfAccounts: AccountTemplate[] = [
  ...CORE_ACCOUNTS,
  ...PERSONAL_INCOME,
  ...PERSONAL_EXPENSES,
];

/** The two sets of books OneDay Books starts with. */
export interface EntityTemplate {
  name: string;
  slug: string;
  taxTreatment: "schedule_c" | "s_corp" | "personal" | "partnership";
  isPersonal: boolean;
  brands: { name: string; slug: string }[];
  chart: AccountTemplate[];
}

export const startingEntities: EntityTemplate[] = [
  {
    name: "Sound Society LLC",
    slug: "sound-society",
    taxTreatment: "schedule_c",
    isPersonal: false,
    brands: [
      { name: "OneDay Sounds", slug: "oneday-sounds" },
      { name: "Ctrl.Booth", slug: "ctrl-booth" },
      { name: "Loud Garden", slug: "loud-garden" },
    ],
    chart: businessChartOfAccounts,
  },
  {
    name: "Personal",
    slug: "personal",
    taxTreatment: "personal",
    isPersonal: true,
    brands: [],
    chart: personalChartOfAccounts,
  },
];

/** Friendly labels for the Schedule C lines, for the tax summary later. */
export const scheduleCLineLabels: Record<string, string> = {
  "1": "Line 1 Gross receipts",
  "8": "Line 8 Advertising",
  "9": "Line 9 Car and truck",
  "11": "Line 11 Contract labor",
  "13": "Line 13 Depreciation and Section 179",
  "15": "Line 15 Insurance",
  "17": "Line 17 Legal and professional",
  "20a": "Line 20a Rent of equipment",
  "20b": "Line 20b Rent of property",
  "21": "Line 21 Repairs",
  "22": "Line 22 Supplies",
  "23": "Line 23 Taxes and licenses",
  "24a": "Line 24a Travel",
  "24b": "Line 24b Meals",
  "25": "Line 25 Utilities",
  "27a": "Line 27a Other expenses",
};
