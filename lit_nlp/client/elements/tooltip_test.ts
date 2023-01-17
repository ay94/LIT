import 'jasmine';

import {LitElement} from 'lit';

import {LitTooltip} from './tooltip';

describe('tooltip test', () => {
  let tooltip: LitTooltip;

  beforeEach(async () => {
    tooltip = new LitTooltip();
    tooltip.content = 'Test content';
    document.body.appendChild(tooltip);
    await tooltip.updateComplete;
  });

  it('should instantiate correctly', () => {
    expect(tooltip).toBeDefined();
    expect(tooltip instanceof HTMLElement).toBeTrue();
    expect(tooltip instanceof LitElement).toBeTrue();
  });

  it('is initially hidden with correct contents', async () => {
    const tooltipText =
        tooltip.renderRoot.querySelector<HTMLSpanElement>('span.tooltip-text')!;
    expect(tooltipText).toBeDefined();
    expect(tooltipText.innerHTML).toContain('Test content');
    const style = window.getComputedStyle(tooltipText);
    expect(style.getPropertyValue('visibility')).toEqual('hidden');
    expect(tooltipText).not.toHaveClass('above');
  });

  it('conditionally renders aria label', async () => {
    expect(tooltip.renderAriaLabel()).not.toEqual(``);
    tooltip.shouldRenderAriaLabel = false;
    expect(tooltip.renderAriaLabel()).toEqual(``);
  });

  it('conditionally updates tooltip position', async () => {
    tooltip.tooltipPosition = 'above';
    await tooltip.updateComplete;
    const tooltipText =
        tooltip.renderRoot.querySelector<HTMLSpanElement>('span.tooltip-text')!;
    expect(tooltipText).toHaveClass('above');
  });
});