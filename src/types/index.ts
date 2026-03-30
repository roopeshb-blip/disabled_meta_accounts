export interface AdAccountStatus {
  seller_id: string;
  seller_name: string;
  ad_account_id: string;
  ad_account_type: string; // seller_paid | nushop_postpaid
  account_status: number; // Meta API status code
  account_status_label: string;
  disable_reason: number | null;
  disable_reason_label: string | null;
  bm_id: string | null;
  bm_name: string | null;
  bm_status: string | null;
  gc_name: string | null;
  gc_id: string | null;
  gm_name: string | null;
  gm_id: string | null;
  a2h_date: string | null;
  last_checked_at: string;
  previous_status: number | null;
  status_changed_at: string | null;
}

export const ACCOUNT_STATUS_MAP: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending Review",
  9: "In Grace Period",
  100: "Pending Risk Review",
  101: "Temporarily Unavailable",
  201: "Pending Settlement",
};

export const DISABLE_REASON_MAP: Record<number, string> = {
  0: "None",
  1: "Ads Integrity Policy",
  2: "Terms of Service",
  3: "Inauthentic Behavior",
  4: "Fraudulent Behavior",
  5: "Business Integrity Policy",
  6: "Prohibited Content",
  7: "Policy Violation (Other)",
};

export type StatusFilter = "all" | "disabled" | "under_review" | "active" | "reactivated";

export interface CheckResult {
  total_checked: number;
  disabled: number;
  under_review: number;
  active: number;
  reactivated: number;
  errors: number;
  checked_at: string;
}
