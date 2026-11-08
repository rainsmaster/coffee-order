export const isWithinStoreHours = (info, now = new Date()) => {
  const match = info?.ordTime?.match(/(\d{2}):(\d{2})\s*~\s*(\d{2}):(\d{2})/);
  if (!match) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = Number(match[1]) * 60 + Number(match[2]);
  const close = Number(match[3]) * 60 + Number(match[4]);
  if (close < open) return minutes >= open || minutes < close;
  return minutes >= open && minutes < close;
};

export const koreaDateKey = (date = new Date()) => date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
