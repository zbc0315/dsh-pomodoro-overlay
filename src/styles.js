export const CSS = String.raw`
.dpo-overlay {
  position: fixed;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  overflow: hidden;
  pointer-events: none;
  container-type: inline-size;
  container-name: dpo;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
}
.dpo-overlay[hidden] { display: none !important; }
.dpo-number {
  font-family: var(--ds-font-family-code, ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace);
  font-size: 120px;
  font-weight: 600;
  font-variant-numeric: tabular-nums lining-nums;
  letter-spacing: -0.065em;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  transform: translateX(-0.0325em);
  transition: color 160ms ease-out, opacity 160ms ease-out;
}
.dpo-phase {
  position: absolute;
  top: 16px;
  left: 20px;
  box-sizing: border-box;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 84%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 20px;
  pointer-events: none;
}
.dpo-button {
  box-sizing: border-box;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 120ms ease-out, color 120ms ease-out;
}
.dpo-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dpo-button:active:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover));
}
.dpo-button:focus-visible,
.dpo-input:focus-visible,
.dpo-color-input:focus-visible,
.dpo-range:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dpo-button:disabled,
.dpo-input:disabled {
  opacity: 0.55;
  cursor: default;
}
.dpo-sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.dpo-settings {
  box-sizing: border-box;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 22px;
}
.dpo-settings h2,
.dpo-settings h3,
.dpo-settings p { margin: 0; }
.dpo-settings h2 { font-size: 18px; line-height: 28px; font-weight: 550; }
.dpo-settings h3 { font-size: 14px; line-height: 22px; font-weight: 500; }
.dpo-description { color: var(--dsw-alias-label-secondary); }
.dpo-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dpo-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dpo-phase-card {
  box-sizing: border-box;
  min-width: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-xl, 16px);
  padding: 16px;
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-base));
}
.dpo-phase-card > legend {
  padding: 0 4px;
  font-size: 14px;
  font-weight: 600;
}
.dpo-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 160px);
  align-items: center;
  gap: 16px;
}
.dpo-field-copy { display: flex; flex-direction: column; gap: 2px; }
.dpo-field-copy label { color: var(--dsw-alias-label-primary); font-weight: 500; }
.dpo-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md, 8px);
  padding: 8px 12px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.dpo-font-control { min-width: 0; }
.dpo-color-control {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.dpo-color-input {
  box-sizing: border-box;
  width: 52px;
  height: 44px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md, 8px);
  padding: 4px;
  background: var(--dsw-alias-bg-base);
  cursor: pointer;
}
.dpo-color-value {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 12px;
}
.dpo-range-control {
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(80px, 1fr) 48px;
  align-items: center;
  gap: 12px;
}
.dpo-range {
  width: 100%;
  min-height: 44px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.dpo-output {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.dpo-preview {
  min-height: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-base);
}
.dpo-preview-number {
  color: var(--dpo-preview-color);
  opacity: var(--dpo-preview-opacity);
  font-family: var(--dpo-preview-font, var(--ds-font-family-code, ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace));
  font-size: 42px;
  font-weight: 600;
  font-variant-numeric: tabular-nums lining-nums;
  line-height: 1;
  letter-spacing: -0.065em;
  user-select: none;
}
.dpo-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.dpo-settings .dpo-button { border: 1px solid var(--dsw-alias-border-l3); }
.dpo-settings .dpo-primary {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.dpo-settings .dpo-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 88%, var(--dsw-alias-label-primary));
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.dpo-error { color: var(--dsw-alias-state-error-primary); font-size: 13px; line-height: 20px; }
.dpo-success { color: var(--dsw-alias-state-success-primary); font-size: 13px; line-height: 20px; }
.dpo-warning { color: var(--dsw-alias-state-warn-label); font-size: 13px; line-height: 20px; }
.dpo-current {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}

@container dpo (max-width: 480px) {
  .dpo-phase { top: 8px; left: 8px; }
}
@media (max-width: 520px) {
  .dpo-field { grid-template-columns: 1fr; gap: 8px; }
  .dpo-actions .dpo-button { flex: 1 1 120px; }
}
@media (pointer: coarse) {
  .dpo-button, .dpo-input, .dpo-range { min-height: 48px; }
  .dpo-color-input { height: 48px; }
}
@media (prefers-reduced-motion: reduce) {
  .dpo-number, .dpo-button { transition: none; }
}
`
