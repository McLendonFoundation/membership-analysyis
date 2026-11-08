export type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
  association_code: string | null;
  role: "lead" | "admin";
  status: "pending" | "approved" | "revoked";
  created_at: string;
};

export type Row = Record<string, any>;

export type Snapshot = {
  association: string;
  kpis: Row;
  geography: { states: Row[]; regions: Row[] };
  institution_depth: { institutions: Row[]; members_per_institution: Row[] };
  new_vs_renewal: Row;
  role_mix: { roles: Row[] };
  payment_pace: Row;
  tenure: Row;
  data_quality: Row[];
  cross_association: Row;
  year_over_year: Row;
  nacda: { narrative: string; causes: string[]; direction: Row[]; agenda: Row[]; caveats: string[] };
  meta: { as_of: string; source: string; version: string };
};
