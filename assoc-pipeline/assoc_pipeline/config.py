"""Static configuration: expected columns, value mappings, region lookup.

Author: Ishita Tibrewal
"""

# Columns the NetForum "All Paids" export must contain (order does not matter).
REQUIRED_COLUMNS = [
    "ID", "Assn", "Assn PM", "PayYear", "RenewStatus", "Mem_Type", "Indiv Type",
    "First", "Last", "Title", "Organization", "City", "State", "Zip", "Email",
    "Org Type", "Division", "Bkb Conf", "FB Conf", "Gender", "Region",
]

# Columns that hold personal data. These never leave the restricted members table.
PII_COLUMNS = ["First", "Last", "Email", "Title"]

# Columns dropped entirely from all outputs (decision: ethnicity is not used).
EXCLUDED_COLUMNS = ["Ethnicity"]

# Associations where RenewStatus holds a date instead of a code.
# Decision (Nov 8, 2026): treat the date as the renewal date, status = Renewal.
DATE_STATUS_ASSNS = {"N4A"}

# Optional columns that unlock "coming soon" features when present.
OPTIONAL_FEATURE_COLUMNS = {
    "paid_date": ["FRD", "Paid Date", "PaidDate"],
    "total_years": ["TTL Years", "Total Years", "TotalYears"],
}

REGIONS = {
    "New England": ["ME", "NH", "VT", "MA", "RI", "CT"],
    "Mid-Atlantic": ["NY", "NJ", "PA", "DE", "MD", "DC"],
    "South": ["VA", "WV", "NC", "SC", "GA", "FL", "KY", "TN", "AL", "MS", "AR", "LA", "TX", "OK"],
    "Midwest": ["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
    "West": ["MT", "ID", "WY", "CO", "NM", "AZ", "UT", "NV", "CA", "OR", "WA", "AK", "HI"],
}
STATE_TO_REGION = {s: r for r, states in REGIONS.items() for s in states}
OTHER_REGION = "Canada/Other"

# Minimum group size for reporting a rate (smaller groups are suppressed).
MIN_GROUP = 10
MIN_ROLE_GROUP = 20
