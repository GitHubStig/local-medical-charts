# 003. Local store: tasks

- [x] App-data path per OS, with a development override
- [x] Database migration 1: patients, reports, results, settings;
      `user_version`; expected-tables check
- [x] `addReport`: parse, refuse wrong files, detect duplicates by content hash,
      upgrade, file under a patient, write results
- [x] Patient identity: normalised ID number, else name and date of birth
- [x] Identity warnings (ID matches another name or birth date; same person
      under another ID)
- [x] `upgradeAll` on launch from originals; keep failures marked
- [x] Queries: patients with report counts and date spans, reports newest first,
      results per patient
- [x] Delete a report (and an empty patient); clear all while keeping settings
- [x] Settings with defaults and validated patches
- [x] Tests on in-memory databases with synthetic reports
