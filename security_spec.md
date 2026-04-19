# Security Specification - Kalyani Hospital CMS

## Data Invariants
1. A patient record must have a unique phone number as its document ID.
2. A visit record must reference a valid patient phone number.
3. A prescription must reference a valid visit ID and a valid patient phone number.
4. All timestamps must be server-validated.

## "The Dirty Dozen" Payloads (Attack Vectors)
1. **Identity Spoofing**: Attempting to create a patient with a fake phone ID.
2. **PII Leakage**: Unauthorized user attempting to read the global patient list.
3. **Ghost Field Injection**: Adding `isAdmin: true` to a patient document.
4. **Invalid Type**: Sending `age: "thirty"` (string) instead of integer.
5. **Resource Exhaustion**: Sending a 1MB string in the `symptoms` field.
6. **Orphaned Visit**: Creating a visit for a patient that doesn't exist in the database.
7. **Timestamp Fraud**: Setting `createdAt` to a date in 2020.
8. **ID Poisoning**: Using `/patients/..%2F..%2Fsys_config` as an ID.
9. **Update Hijack**: Overwriting a patient's phone number after creation.
10. **Schema Bypass**: Creating a visit missing the required `date` field.
11. **Massive List Scraping**: Running a query without any filters to dump all health data.
12. **Anonymous Write**: Attempting to save a prescription without being logged in.

## Test Strategy
- Verify that only authenticated users can access the system.
- Enforce strict key validation for all entities.
- Ensure document IDs are within valid size limits.
- Validate that relational data pointers exist before allowing writes.
