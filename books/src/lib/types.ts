import type { TxnType } from "./ledger";
import type { AccountType } from "./chart-of-accounts";

/** A category or ledger account as the UI needs it. */
export interface AccountLite {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
}

export interface BrandLite {
  id: string;
  name: string;
}

/** An entity with everything the add form needs to work offline of the server. */
export interface EntityWithAccounts {
  id: string;
  name: string;
  is_personal: boolean;
  accounts: AccountLite[];
  brands: BrandLite[];
}

/** What the add transaction form sends to the server. */
export interface AddTxnInput {
  entityId: string;
  type: TxnType;
  amountCents: number;
  entryDate: string; // YYYY-MM-DD
  categoryAccountId?: string;
  moneyAccountId?: string;
  secondMoneyAccountId?: string;
  ownerAccountId?: string;
  brandId?: string | null;
  memo?: string;
}
