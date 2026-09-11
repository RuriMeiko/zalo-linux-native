export const applicationPayloadRoots=Object.freeze([
  'bootstrap.js','package.json','version.txt','libs','main-dist','pc-dist','native','scripts',
  'start.sh','update.sh','CREDITS.md','README.md','NATIVE-LAUNCH.md','NATIVE-INSTALL.md','NATIVE-TESTING.md',
  'NATIVE-PACKAGING.md',
  'INTEGRATION-STATUS.md','LINUX-DESKTOP-EXTRAS.md','CALL-LINUX.md','CALL-SMOKE.md','HEADER-REGRESSION.md',
  'RELEASE-CHECKLIST.md','PORT-CHECKLIST.md','PUBLICATION-AUDIT-ALLOWLIST.json'
]);

export function selectApplicationPayload(files) {
  if(!Array.isArray(files))throw new TypeError('Payload file list must be an array');
  return files.filter(file=>applicationPayloadRoots.some(root=>file===root || file.startsWith(root+'/')));
}
