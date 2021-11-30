import * as timeHelpers from "../tests/helpers/time";

async function main() {
  await timeHelpers.advanceTimestampAndBlock(timeHelpers.HOUR);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
