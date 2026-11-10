import React, { useEffect, useState } from 'react';
import './CustomOptionsPanel.css';

const CustomOptionsPanel = ({ customOptions, selectedCustom, onChange, onClose, disabled = false }) => {
  const [openCategories, setOpenCategories] = useState({});
  const [activeGroups, setActiveGroups] = useState({});

  useEffect(() => {
    setOpenCategories({});
    setActiveGroups({});
  }, [customOptions?.menuCd]);

  const categories = customOptions.categories?.length
    ? customOptions.categories
    : [{
      categoryKey: 'custom',
      categoryName: '퍼스널 옵션',
      qtyItems: customOptions.qtyItems || [],
      choiceGroups: customOptions.choiceGroups || [],
    }];

  const updateQuantity = (item, quantity) => {
    onChange({
      ...selectedCustom,
      qty: {
        ...selectedCustom.qty,
        [item.key]: Math.max(0, Math.min(item.maxQty || 2, quantity)),
      },
    });
  };

  const toggleGroup = (group, checked) => {
    const nextChoices = { ...selectedCustom.choices };
    setActiveGroups((previous) => {
      const next = { ...previous, [group.groupKey]: checked };
      if (checked && group.exclusiveGroupKey) {
        for (const sibling of customOptions.choiceGroups || []) {
          if (sibling.groupKey !== group.groupKey
            && sibling.exclusiveGroupKey === group.exclusiveGroupKey) {
            next[sibling.groupKey] = false;
          }
        }
      }
      return next;
    });
    if (checked && group.exclusiveGroupKey) {
      for (const sibling of customOptions.choiceGroups || []) {
        if (sibling.groupKey !== group.groupKey
          && sibling.exclusiveGroupKey === group.exclusiveGroupKey) {
          delete nextChoices[sibling.groupKey];
        }
      }
    }
    if (checked && group.defaultChoiceKey) {
      nextChoices[group.groupKey] = group.defaultChoiceKey;
    } else if (!checked) {
      delete nextChoices[group.groupKey];
    }
    onChange({ ...selectedCustom, choices: nextChoices });
  };

  const selectChoice = (group, choiceKey) => {
    setActiveGroups((previous) => ({ ...previous, [group.groupKey]: true }));
    onChange({
      ...selectedCustom,
      choices: { ...selectedCustom.choices, [group.groupKey]: choiceKey },
    });
  };

  const clearChoice = (group) => {
    const nextChoices = { ...selectedCustom.choices };
    delete nextChoices[group.groupKey];
    setActiveGroups((previous) => ({ ...previous, [group.groupKey]: false }));
    onChange({ ...selectedCustom, choices: nextChoices });
  };

  const hasSelection = Object.values(selectedCustom.qty).some((quantity) => quantity > 0)
    || Object.values(selectedCustom.choices).some(Boolean);

  const resetAll = () => {
    setActiveGroups({});
    onChange({ qty: {}, choices: {} });
  };

  const selectedPrice = (category) => {
    let total = 0;
    for (const item of category.qtyItems || []) {
      total += (item.unitPrice || 0) * (selectedCustom.qty[item.key] || 0);
    }
    for (const group of category.choiceGroups || []) {
      const selectedKey = selectedCustom.choices[group.groupKey];
      const choice = (group.choices || []).find((item) => item.choiceKey === selectedKey);
      total += choice?.price || 0;
    }
    return total;
  };

  return (
    <div className="custom-categories">
      {categories.map((category) => {
        const isOpen = Boolean(openCategories[category.categoryKey]);
        const price = selectedPrice(category);
        return (
          <section className="custom-category" key={category.categoryKey}>
            <button
              type="button"
              className="custom-category-header"
              aria-expanded={isOpen}
              onClick={() => setOpenCategories((previous) => ({
                ...previous,
                [category.categoryKey]: !isOpen,
              }))}
            >
              <span className="custom-category-name">{category.categoryName}</span>
              {price > 0 && <span className="custom-category-price">+{price.toLocaleString()}원</span>}
              <span className={`custom-category-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="custom-category-body">
                {(category.qtyItems || []).map((item) => {
                  const qty = selectedCustom.qty[item.key] || 0;
                  return (
                    <div key={item.key} className="custom-qty-row">
                      <span className="custom-qty-name">
                        {item.name}
                        <span className="custom-qty-price">(+{item.unitPrice.toLocaleString()}원)</span>
                      </span>
                      <div className="cart-qty-controls">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`${item.name} 수량 줄이기`}
                          onClick={() => updateQuantity(item, qty - 1)}
                          disabled={disabled || qty <= 0}
                        >
                          -
                        </button>
                        <span className="cart-qty">{qty}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`${item.name} 수량 늘리기`}
                          onClick={() => updateQuantity(item, qty + 1)}
                          disabled={disabled || qty >= (item.maxQty || 2)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                {(category.choiceGroups || []).map((group) => {
                  const selectedKey = selectedCustom.choices[group.groupKey];
                  const isChecked = activeGroups[group.groupKey] ?? Boolean(selectedKey);
                  return (
                    <div className="custom-choice-item" key={group.groupKey}>
                      {group.toggleable ? (
                        <div className="custom-choice-toggle-row">
                          <label className="custom-choice-toggle">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => toggleGroup(group, event.target.checked)}
                              disabled={disabled}
                            />
                            <span>{group.name}</span>
                          </label>
                          <span className="custom-choice-price">
                            {group.displayPrice > 0 ? `${group.displayPrice.toLocaleString()}원` : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="custom-choice-heading">
                          <div className="custom-choice-title">{group.name}</div>
                          {selectedKey && (
                            <button
                              type="button"
                              className="custom-choice-clear"
                              aria-label={`${group.name} 선택 해제`}
                              onClick={() => clearChoice(group)}
                              disabled={disabled}
                            >
                              해제
                            </button>
                          )}
                        </div>
                      )}
                      {(!group.toggleable || isChecked) && (
                        <div className="custom-choice-options">
                          {(group.choices || []).map((choice) => (
                            <label className="custom-choice-option" key={choice.choiceKey}>
                              <input
                                type="radio"
                                name={`custom-choice-${group.groupKey}`}
                                checked={selectedKey === choice.choiceKey}
                                onChange={() => selectChoice(group, choice.choiceKey)}
                                disabled={disabled}
                              />
                              <span>{choice.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      <div className="custom-accordion-actions">
        <button
          type="button"
          className="custom-accordion-reset"
          onClick={resetAll}
          disabled={disabled || !hasSelection}
          title="선택한 퍼스널 옵션을 모두 해제합니다"
        >
          초기화
        </button>
        <button
          type="button"
          className="custom-accordion-close"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default CustomOptionsPanel;
