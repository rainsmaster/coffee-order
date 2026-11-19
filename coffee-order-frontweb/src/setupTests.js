import '@testing-library/jest-dom';

const elementMatches = Element.prototype.matches;
Element.prototype.matches = function matches(selector) {
  if (selector === ':modal') {
    return this instanceof HTMLDialogElement && this.hasAttribute('open');
  }
  return elementMatches.call(this, selector);
};

if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
