export const needsOptionConfirmation = (order) =>
  order?.menuType === 'TWOSOME' && (!order.variantMenuCd || !order.variantOpts);

const normalizeLabel = (value) => (value || '').trim().toLocaleLowerCase();

export const restoreOptionSelections = (menuOptions, personalOption) => {
  const savedLabels = (personalOption || '')
    .split(/[|/,]/)
    .map(normalizeLabel)
    .filter(Boolean);
  const restored = {};

  for (const group of menuOptions?.groups || []) {
    const options = group.options || [];
    const saved = options.find((option) => savedLabels.includes(normalizeLabel(option.optNm)));
    const selected = saved || options.find((option) => option.defaultOpt);
    if (selected) restored[group.grpCd] = selected.opts;
  }

  return restored;
};
