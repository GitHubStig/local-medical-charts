/**
 * Version of the stored JSON format: page files and merged reports.
 *
 * Stays at 1 while the app is in development: edit the schemas in place and
 * regenerate local data. After release, bump it whenever a change would make
 * previously written JSON fail validation, and add a migration in src/migrations/.
 *
 * Kept free of imports so browser code can check versions without pulling in Zod.
 */
export const SCHEMA_VERSION = 1;
