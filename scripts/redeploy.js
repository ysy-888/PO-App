/**
 * Push apps-script.gs + templates, then update the existing Web app deployment
 * (same /exec URL as in js/config.js). Usage: node scripts/redeploy.js test|prod [description]
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const env = process.argv[2];
if (!env || !["test", "prod"].includes(env)) {
  console.error("Usage: node scripts/redeploy.js test|prod [description]");
  process.exit(1);
}

const claspFile = path.join(__dirname, "..", `.clasp.${env}.json`);
const config = JSON.parse(fs.readFileSync(claspFile, "utf8"));
if (!config.deploymentId) {
  console.error(`Missing deploymentId in .clasp.${env}.json (middle segment of APPS_SCRIPT_URL in js/config.js)`);
  process.exit(1);
}

const description = process.argv.slice(3).join(" ").trim() || `${env} redeploy`;
fs.copyFileSync(claspFile, path.join(__dirname, "..", ".clasp.json"));

console.log(`Pushing ${env} project…`);
execSync("npx clasp push --force", { stdio: "inherit", cwd: path.join(__dirname, "..") });

console.log(`Updating Web app deployment ${config.deploymentId}…`);
execSync(`npx clasp deploy -i ${config.deploymentId} -d "${description.replace(/"/g, '\\"')}"`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  shell: true,
});

console.log(`${env} backend live at the same /exec URL (see js/config.js).`);
