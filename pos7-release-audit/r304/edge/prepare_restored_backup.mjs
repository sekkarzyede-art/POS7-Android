import { canonicalSha256 } from '../../r300/edge/verify_proof.mjs';

export async function prepareRestoredBackup({ exporter, storage, branch, snapshotBuilder, nativeOfflineGate }) {
  const restored = await exporter.build({
    storage, branch, snapshotBuilder, expectedLocalRestored: nativeOfflineGate === true,
  });
  const backup = {
    format: 'POS7-R304-RESTORED-BACKUP',
    branch: restored.branch,
    localStateSha256: restored.localStateSha256,
    sections: restored.sections,
  };
  return { backup, sectionsSha256: await canonicalSha256(backup) };
}
