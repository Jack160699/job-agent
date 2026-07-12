import "dotenv/config";
import { processBackgroundJobs } from "../src/lib/jobs/background";

async function main() {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const results = await processBackgroundJobs();
    total += results.length;
    console.log(`Batch ${i + 1}: processed ${results.length} (total ${total})`);
    if (results.length === 0) break;
  }
  console.log(`Drain complete. Total processed: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
