# Membership Analysis

Weekly per-association membership analysis for NACDA-managed associations, structured with the NACDA Framework.
Created by Ishita Tibrewal.

- `assoc-pipeline/` Python package (see its README)
- `.github/workflows/tests.yml` runs the tests on every push
- `.github/workflows/weekly.yml` Monday run (data steps switch on once Supabase is set up)
- `setup_local.ps1` local setup and test run on Windows
- `data/` and `out/` are local only and ignored by git (member data never goes to GitHub)
