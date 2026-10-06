// C6 canonicalization — the localStorage test seed (demo questions, demo
// tests, seeded notifications) is removed with the legacy engine. Only the
// demo identity constants remain: lib/studentAuth.ts references them and
// the demo-auth shim is out of scope for the test migration.
export const DEMO_STUDENT = { id: "STU-1001", name: "Demo Student" };
export const DEMO_FACULTY = { id: "FAC-1001", name: "Demo Faculty" };
