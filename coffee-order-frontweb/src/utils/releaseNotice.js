export const shouldShowRelease = (note, storage, dateKey) => {
  if (!note?.version) return false;
  try {
    return storage.getItem(`releaseNotice:${note.version}:dismissedOn`) !== dateKey;
  } catch {
    return true;
  }
};

export const dismissReleaseForToday = (note, storage, dateKey) => {
  if (!note?.version) return;
  try {
    storage.setItem(`releaseNotice:${note.version}:dismissedOn`, dateKey);
  } catch {
    // 저장이 불가능한 브라우저에서는 현재 화면에서만 닫는다.
  }
};
