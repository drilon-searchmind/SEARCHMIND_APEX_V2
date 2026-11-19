/**
 * @deprecated Use scripts/aura-import-aura-inputs-from-sheet.mjs (--keys=conversions).
 */
import { runAuraInputImport } from "./aura-import-aura-inputs-from-sheet.mjs";

if (!process.argv.some((a) => a.startsWith("--keys="))) {
    process.argv.push("--keys=conversions");
}

runAuraInputImport().catch((e) => {
    console.error(e);
    process.exit(1);
});