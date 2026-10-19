// TestFlight for the owner through the App Store Connect API (key: scripts/asc-api.mjs): an internal group (the
// account's own people, no Apple review) with every build, also on Macs with Apple silicon, and the account holder in
// it. Reports the latest build's processing; --wait waits until Apple has processed it (up to 30 minutes).
//   node scripts/asc-testflight.mjs [--wait]
import { api, all, appByBundleId, BUNDLE_ID } from './asc-api.mjs';

const GROUP = 'Qwerty3D';
const WAIT = process.argv.includes('--wait');

const app = await appByBundleId(BUNDLE_ID);
if (!app) {
  console.error(`No app with bundle ID ${BUNDLE_ID} in App Store Connect`);
  process.exit(2);
}

// The latest build and its processing (VALID = ready to install)
let build = null;
for (let i = 0; ; i++) {
  const res = await api('GET', `/v1/builds?filter%5Bapp%5D=${app.id}&sort=-uploadedDate&limit=1&include=preReleaseVersion`);
  build = res.data[0] ?? null;
  const st = build?.attributes.processingState;
  if (!WAIT || st === 'VALID' || st === 'FAILED' || st === 'INVALID' || i >= 60) break;
  await new Promise((r) => setTimeout(r, 30000));
}
if (build) {
  const pre = build.relationships?.preReleaseVersion?.data?.id;
  const ver = pre ? (await api('GET', `/v1/preReleaseVersions/${pre}`)).data.attributes.version : '?';
  console.log(`Build ${ver} (${build.attributes.version}): ${build.attributes.processingState}, uploaded ${build.attributes.uploadedDate}`);
} else {
  console.log('No build in App Store Connect yet');
}

// The internal group: every build, iPad builds on Apple silicon Macs too
const groups = await all(`/v1/betaGroups?filter%5Bapp%5D=${app.id}`);
let group = groups.find((g) => g.attributes.isInternalGroup);
if (!group) {
  group = (await api('POST', '/v1/betaGroups', {
    data: { type: 'betaGroups', attributes: { name: GROUP, isInternalGroup: true, hasAccessToAllBuilds: true }, relationships: { app: { data: { type: 'apps', id: app.id } } } },
  })).data;
  console.log(`Internal group ${GROUP}: created`);
}
if (!group.attributes.iosBuildsAvailableForAppleSiliconMac) {
  await api('PATCH', `/v1/betaGroups/${group.id}`, { data: { type: 'betaGroups', id: group.id, attributes: { iosBuildsAvailableForAppleSiliconMac: true } } });
  console.log(`Group ${group.attributes.name}: builds also on Macs with Apple silicon`);
}
if (build && !group.attributes.hasAccessToAllBuilds) {
  await api('POST', `/v1/betaGroups/${group.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
  console.log(`Group ${group.attributes.name}: build added`);
}

// The account holder as a tester (the TestFlight app on their devices, signed in with the same Apple Account)
const users = await all('/v1/users?limit=200');
const holder = users.find((u) => u.attributes.roles.includes('ACCOUNT_HOLDER'));
const testers = await all(`/v1/betaGroups/${group.id}/betaTesters?limit=200`);
let count = testers.length;
if (holder && !testers.some((t) => t.attributes.email?.toLowerCase() === holder.attributes.username.toLowerCase())) {
  await api('POST', '/v1/betaTesters', {
    data: {
      type: 'betaTesters',
      attributes: { email: holder.attributes.username, firstName: holder.attributes.firstName, lastName: holder.attributes.lastName },
      relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } },
    },
  });
  count++;
  console.log('Account holder added to the internal group');
}
console.log(`Group ${group.attributes.name}: ${count} testers`);
