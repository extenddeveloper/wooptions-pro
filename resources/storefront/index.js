/**
 * Editable JavaScript source reconstructed from the storefront production bundle.
 * Run npm run build after changing this file.
 */

(() => {
    "use strict";
    const e = window.WooOptionsProStorefront?.i18n ?? {}, t = { checking: e.checking ?? "Checking your options…", confirmed: e.confirmed ?? "Configuration confirmed", couldNotQuote: e.couldNotQuote ?? "Please review your options before adding this product.", uploading: e.uploading ?? "Uploading…", uploadComplete: e.uploadComplete ?? "Upload complete" }, o = window.WooOptionsProStorefront?.restRoot ?? "/wp-json/wooptions-pro/v1/";
    function r(e) { return window.CSS?.escape ? window.CSS.escape(e) : e.replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
    class a {
        quoteTimer = 0;
        aborter = null;
        lastQuote = null;
        lastSelection = "";
        interactionRecorded = !1;
        isSubmitting = !1;
        savedUuid = "";
        productImageSnapshot = null;
        hasSubmitted = !1;
        constructor(e) { this.root = e; const t = e.querySelector("[data-wof-config]"); if (!t?.textContent)
            throw new Error("WooOptionsPro configuration payload is missing."); this.payload = JSON.parse(t.textContent), this.configuration = this.payload.configuration, this.form = e.closest("form.cart"), this.root.querySelectorAll("input, select, textarea").forEach(e => { e.disabled && (e.dataset.wofFixedDisabled = "true"), e.required = !1; });
            (this.configuration?.fields ?? []).forEach(f => {
                if (f && f.disabled && f.uuid) {
                    const el = this.root.querySelector(`[data-wof-field="${r(f.uuid)}"]`);
                    if (el) {
                        el.hidden = true;
                        el.style.display = "none";
                        el.classList.add("is-disabled");
                        el.querySelectorAll("input, select, textarea").forEach(inp => {
                            inp.disabled = true;
                            inp.dataset.wofFixedDisabled = "true";
                        });
                    }
                }
            });
            this.bind(), this.updateRangeOutputs(), this.updateColorOutputs(), this.initCustomSelects(), this.initCustomDateTimes(), this.initCustomDateRanges(), this.initCustomColorPickers(), this.applyConfigurationSettings(), this.applyConfigurationStyle(), this.loadSharedConfiguration(), this.updateProductImage(), this.enforceMaxChoices(), this.scheduleQuote(50); }
        bind() {
            this.root.addEventListener("input", e => {
                const t = e.target;
                if (t.matches("[data-wof-phone-search]")) {
                    const q = (t.value || "").toLowerCase().trim();
                    const qClean = q.replace(/^\+/, "");
                    const picker = t.closest("[data-wof-phone-picker]");
                    if (picker) {
                        picker.querySelectorAll("[data-wof-phone-option]").forEach(opt => {
                            const name = (opt.dataset.name || "").toLowerCase();
                            const code = (opt.dataset.code || "").toLowerCase();
                            const dial = (opt.dataset.dial || "").toLowerCase();
                            const dialClean = dial.replace(/^\+/, "");
                            const match = !q || name.includes(q) || code.includes(q) || dial.includes(q) || (qClean.length > 0 && dialClean.includes(qClean));
                            opt.classList.toggle("is-hidden", !match);
                            opt.hidden = !match;
                            if (match) {
                                opt.style.removeProperty("display");
                            } else {
                                opt.style.setProperty("display", "none", "important");
                            }
                            opt.classList.remove("is-active");
                        });
                        const firstMatch = picker.querySelector("[data-wof-phone-option]:not(.is-hidden):not([hidden])");
                        if (firstMatch) {
                            firstMatch.classList.add("is-active");
                        }
                    }
                    return;
                }
                t.matches("[data-wof-save-name]") || (this.updateRangeOutputs(), this.selectionChanged(t));
            });
            this.root.addEventListener("keydown", e => {
                const t = e.target;
                if (t.matches("[data-wof-phone-search]")) {
                    const picker = t.closest("[data-wof-phone-picker]");
                    if (!picker) return;

                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        const visibleOpts = Array.from(picker.querySelectorAll("[data-wof-phone-option]")).filter(opt => !opt.classList.contains("is-hidden") && !opt.hidden && opt.style.display !== "none");
                        const targetOpt = visibleOpts.find(opt => opt.classList.contains("is-active")) || visibleOpts[0];
                        if (targetOpt) {
                            const code = targetOpt.dataset.code || "";
                            const select = picker.querySelector("[data-wof-phone-select]");
                            if (select) {
                                select.value = code;
                                this.updatePhoneCountry(select);
                                select.dispatchEvent(new Event("change", { bubbles: true }));
                            }
                            this.closeAllPhonePickers();
                            const numInput = picker.closest("[data-wof-phone-wrap]")?.querySelector(".wof-phone-number-input");
                            if (numInput) {
                                numInput.focus();
                            }
                        }
                        return;
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        this.closeAllPhonePickers();
                        const trigger = picker.querySelector("[data-wof-phone-trigger]");
                        if (trigger) trigger.focus();
                        return;
                    }
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        const visibleOpts = Array.from(picker.querySelectorAll("[data-wof-phone-option]")).filter(opt => !opt.classList.contains("is-hidden") && !opt.hidden && opt.style.display !== "none");
                        if (!visibleOpts.length) return;
                        let activeIdx = visibleOpts.findIndex(opt => opt.classList.contains("is-active"));
                        if (e.key === "ArrowDown") {
                            activeIdx = activeIdx < visibleOpts.length - 1 ? activeIdx + 1 : 0;
                        } else {
                            activeIdx = activeIdx > 0 ? activeIdx - 1 : visibleOpts.length - 1;
                        }
                        visibleOpts.forEach((opt, idx) => {
                            opt.classList.toggle("is-active", idx === activeIdx);
                            if (idx === activeIdx) {
                                opt.scrollIntoView({ block: "nearest" });
                            }
                        });
                        return;
                    }
                }
            });
            this.root.addEventListener("focusout", e => {
                const t = e.target;
                if (!t || !t.matches) return;
                const fieldEl = t.closest("[data-wof-field]");
                if (!fieldEl) return;
                const type = fieldEl.dataset.wofType || t.type || "";
                if (type === "email" || type === "url" || type === "tel" || t.type === "email" || t.type === "url" || t.type === "tel" || t.classList?.contains("wof-phone-number-input")) {
                    const err = this.validateSingleField(fieldEl);
                    if (err) {
                        this.setFieldError(fieldEl, this.errorText(err.code, err.label, err.params));
                    } else {
                        this.clearFieldError(fieldEl);
                    }
                }
            });
            this.root.addEventListener("change", e => { const t = e.target; if (t.matches("[data-wof-phone-select]")) { this.updatePhoneCountry(t); this.selectionChanged(t); } else if (t.matches("[data-wof-upload-input]")) { this.upload(t); } else { const cs = t.closest("[data-wof-custom-select]"); if (cs) { this.syncCustomSelect(cs); } if (t.matches(".wof-product-variation-select")) { this.updateChoiceVariationPrice(t); if (t.value) { const tile = t.closest(".wof-product-choice-tile"); if (tile) { const inp = tile.querySelector('input[type="radio"], input[type="checkbox"]'); if (inp && !inp.checked) { inp.checked = true; inp.dispatchEvent(new Event("change", { bubbles: true })); } } } } if (t.matches(".wof-choice-qty-input") && t.value) { const tile = t.closest(".wof-product-choice-tile, .wof-choice"); if (tile) { const inp = tile.querySelector('input[type="radio"], input[type="checkbox"]'); if (inp && !inp.checked) { inp.checked = true; inp.dispatchEvent(new Event("change", { bubbles: true })); } } } this.selectionChanged(t); } });
            this.root.addEventListener("click", e => { const t = e.target;
                if (t.closest("[data-wof-phone-search]")) {
                    return;
                }
                const phoneTrigger = t.closest("[data-wof-phone-trigger]");
                if (phoneTrigger) {
                    const picker = phoneTrigger.closest("[data-wof-phone-picker]");
                    if (picker) {
                        const isOpen = picker.classList.contains("is-open");
                        this.closeAllPhonePickers(isOpen ? null : picker);
                        this.closeAllCustomSelects();
                        this.closeAllCustomColorPickers();
                        this.closeAllCustomDateTimes();
                        this.closeAllCustomDateRanges();
                        picker.classList.toggle("is-open", !isOpen);
                        phoneTrigger.setAttribute("aria-expanded", !isOpen ? "true" : "false");
                        if (!isOpen) {
                            const search = picker.querySelector("[data-wof-phone-search]");
                            if (search) {
                                search.value = "";
                                picker.querySelectorAll("[data-wof-phone-option]").forEach(opt => {
                                    opt.classList.remove("is-hidden");
                                    opt.classList.remove("is-active");
                                    opt.hidden = false;
                                    opt.style.removeProperty("display");
                                });
                                setTimeout(() => search.focus(), 60);
                            }
                        }
                    }
                    return;
                }
                const phoneOption = t.closest("[data-wof-phone-option]");
                if (phoneOption) {
                    const picker = phoneOption.closest("[data-wof-phone-picker]");
                    if (picker) {
                        const code = phoneOption.dataset.code || "";
                        const select = picker.querySelector("[data-wof-phone-select]");
                        if (select) {
                            select.value = code;
                            this.updatePhoneCountry(select);
                            select.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                        this.closeAllPhonePickers();
                        const numInput = picker.closest("[data-wof-phone-wrap]")?.querySelector(".wof-phone-number-input");
                        if (numInput) {
                            numInput.focus();
                        }
                    }
                    return;
                }
                const modalTrigger = t.closest(".wof-modal-trigger");
                if (modalTrigger) {
                    const targetId = modalTrigger.dataset.wofModalTarget;
                    const modal = targetId ? document.getElementById(targetId) : modalTrigger.closest(".wof-field--modal")?.querySelector(".wof-modal-backdrop");
                    if (modal) {
                        modal.style.display = "flex";
                        modal.setAttribute("aria-hidden", "false");
                        modal.classList.add("is-open");
                        modalTrigger.setAttribute("aria-expanded", "true");
                        document.body.classList.add("wof-modal-open");
                    }
                    return;
                }
                const modalClose = t.closest(".wof-modal-close");
                if (modalClose) {
                    const modal = modalClose.closest(".wof-modal-backdrop");
                    if (modal) {
                        modal.style.display = "none";
                        modal.setAttribute("aria-hidden", "true");
                        modal.classList.remove("is-open");
                        const trigger = modal.closest(".wof-field--modal")?.querySelector(".wof-modal-trigger");
                        trigger?.setAttribute("aria-expanded", "false");
                        document.body.classList.remove("wof-modal-open");
                    }
                    return;
                }
                if (t.classList.contains("wof-modal-backdrop")) {
                    t.style.display = "none";
                    t.setAttribute("aria-hidden", "true");
                    t.classList.remove("is-open");
                    const trigger = t.closest(".wof-field--modal")?.querySelector(".wof-modal-trigger");
                    trigger?.setAttribute("aria-expanded", "false");
                    document.body.classList.remove("wof-modal-open");
                    return;
                }
                const breakdownTrigger = t.closest("[data-wof-breakdown-trigger]");
                if (breakdownTrigger) {
                    const summary = breakdownTrigger.closest("[data-wof-summary]") || this.root;
                    const modal = summary.querySelector("[data-wof-breakdown-modal]");
                    if (modal) {
                        modal.hidden = false;
                        modal.classList.add("is-open");
                        breakdownTrigger.setAttribute("aria-expanded", "true");
                        document.body.classList.add("wof-modal-open");
                    }
                    return;
                }
                const breakdownClose = t.closest("[data-wof-breakdown-close]");
                if (breakdownClose) {
                    const modal = breakdownClose.closest("[data-wof-breakdown-modal]");
                    if (modal) {
                        modal.hidden = true;
                        modal.classList.remove("is-open");
                        document.body.classList.remove("wof-modal-open");
                        const trigger = this.root.querySelector("[data-wof-breakdown-trigger]");
                        if (trigger) trigger.setAttribute("aria-expanded", "false");
                    }
                    return;
                }
                const saveModalTrigger = t.closest("[data-wof-save-modal-trigger]");
                if (saveModalTrigger) {
                    const summary = saveModalTrigger.closest("[data-wof-summary]") || this.root;
                    const modal = summary.querySelector("[data-wof-save-modal]");
                    if (modal) {
                        modal.hidden = false;
                        modal.classList.add("is-open");
                        saveModalTrigger.setAttribute("aria-expanded", "true");
                        document.body.classList.add("wof-modal-open");
                    }
                    return;
                }
                const saveModalClose = t.closest("[data-wof-save-modal-close]");
                if (saveModalClose) {
                    const modal = saveModalClose.closest("[data-wof-save-modal]");
                    if (modal) {
                        modal.hidden = true;
                        modal.classList.remove("is-open");
                        document.body.classList.remove("wof-modal-open");
                        const trigger = this.root.querySelector("[data-wof-save-modal-trigger]");
                        if (trigger) trigger.setAttribute("aria-expanded", "false");
                    }
                    return;
                }
                const accTrigger = t.closest("[data-wof-accordion-trigger]"); if (accTrigger) { const sec = accTrigger.closest("[data-wof-accordion]"); if (sec) { const isOpen = sec.classList.contains("is-open"); sec.classList.toggle("is-open", !isOpen); const body = sec.querySelector("[data-wof-accordion-body]"); if (body) { body.hidden = isOpen; body.style.display = isOpen ? "none" : ""; } accTrigger.setAttribute("aria-expanded", !isOpen ? "true" : "false"); } return; } const qtyInc = t.closest("[data-wof-repeater-qty-inc]"); if (qtyInc) { const wrap = qtyInc.closest("[data-wof-repeater-quantity]"); const rep = wrap?.closest("[data-wof-field]")?.querySelector("[data-wof-repeater]"); const input = wrap?.querySelector("[data-wof-repeater-qty-input]"); if (rep && input) { const max = Number(rep.dataset.max || 100); const curr = Number(input.value || 1); if (curr < max) { input.value = String(curr + 1); this.addRow(rep); } } return; } const qtyDec = t.closest("[data-wof-repeater-qty-dec]"); if (qtyDec) { const wrap = qtyDec.closest("[data-wof-repeater-quantity]"); const rep = wrap?.closest("[data-wof-field]")?.querySelector("[data-wof-repeater]"); const input = wrap?.querySelector("[data-wof-repeater-qty-input]"); if (rep && input) { const min = Math.max(1, Number(rep.dataset.min || 1)); const curr = Number(input.value || 1); if (curr > min) { input.value = String(curr - 1); const rows = rep.querySelectorAll(":scope > [data-wof-repeater-rows] > [data-wof-row], :scope [data-wof-row]"); if (rows.length > 0) { this.removeRow(rows[rows.length - 1]); } } } return; } const cpTrigger = t.closest("[data-wof-color-trigger]"); if (cpTrigger) { this.toggleCustomColorPicker(cpTrigger); return; } const csTrigger = t.closest("[data-wof-custom-select-trigger]"); if (csTrigger) { const cs = csTrigger.closest("[data-wof-custom-select]"); if (cs) { const isOpen = cs.classList.contains("is-open"); this.closeAllCustomSelects(isOpen ? null : cs); cs.classList.toggle("is-open", !isOpen); csTrigger.setAttribute("aria-expanded", !isOpen ? "true" : "false"); } return; } const csOption = t.closest(".wof-custom-select__option"); if (csOption) { if (csOption.classList.contains("is-disabled")) return; const cs = csOption.closest("[data-wof-custom-select]"); if (cs) { const val = csOption.dataset.wofOptionValue ?? ""; const nativeSelect = cs.querySelector("select"); if (nativeSelect) { nativeSelect.value = val; this.syncCustomSelect(cs, csOption); nativeSelect.dispatchEvent(new Event("change", { bubbles: true })); } cs.classList.remove("is-open"); cs.querySelector("[data-wof-custom-select-trigger]")?.setAttribute("aria-expanded", "false"); } return; } const dtTrigger = t.closest("[data-wof-datetime-trigger]"); if (dtTrigger) { this.toggleCustomDateTime(dtTrigger); return; } const drTrigger = t.closest("[data-wof-daterange-trigger]"); if (drTrigger) { this.toggleCustomDateRange(drTrigger); return; } const o = t.closest("[data-wof-upload-remove]"); if (o)
            return void this.removeUpload(o); const r = t.closest("[data-wof-add-row]"); if (r)
            return void this.addRow(r); const a = t.closest("[data-wof-remove-row]"); if (a)
            return void this.removeRow(a); const i = t.closest("[data-wof-move-row]"); i ? this.moveRow(i) : t.closest("[data-wof-save]") ? this.saveConfiguration() : t.closest("[data-wof-share]") ? this.shareConfiguration() : t.closest("[data-wof-copy-share]") && this.copyShareLink(); });
            document.addEventListener("click", e => { if (!e.target.closest("[data-wof-phone-picker]")) { this.closeAllPhonePickers(); } if (!e.target.closest("[data-wof-custom-select]")) { this.closeAllCustomSelects(); } if (!e.target.closest("[data-wof-custom-datetime]")) { this.closeAllCustomDateTimes(); } if (!e.target.closest("[data-wof-custom-daterange]")) { this.closeAllCustomDateRanges(); } if (!e.target.closest("[data-wof-color-picker]")) { this.closeAllCustomColorPickers(); } });
            document.addEventListener("keydown", e => {
                if (e.key === "Escape") {
                    this.closeAllPhonePickers();
                    document.querySelectorAll(".wof-modal-backdrop.is-open, [data-wof-breakdown-modal].is-open, [data-wof-save-modal].is-open").forEach(modal => {
                        modal.style.display = "none";
                        modal.hidden = true;
                        modal.setAttribute("aria-hidden", "true");
                        modal.classList.remove("is-open");
                        const trigger = modal.closest(".wof-field--modal")?.querySelector(".wof-modal-trigger") || document.querySelector("[data-wof-breakdown-trigger]") || document.querySelector("[data-wof-save-modal-trigger]");
                        trigger?.setAttribute("aria-expanded", "false");
                    });
                    document.body.classList.remove("wof-modal-open");
                }
            });
            this.form?.addEventListener("submit", e => {
                if (this.isSubmitting) return;
                const clientErrors = this.validateAllFields();
                if (clientErrors.length > 0) {
                    e.preventDefault();
                    e.stopImmediatePropagation?.();
                    this.hasSubmitted = !0;
                    this.clearAllErrors();
                    this.renderErrors(clientErrors, !0);
                    this.setStatus(t.couldNotQuote, "error");
                    this.showToast(this.getValidationToastMessage(clientErrors), "error");
                    return;
                }
                const sel = this.readSelection();
                this.writeSelection(sel);
                const vars = this.readProductVariations();
                const qtys = this.readChoiceQuantities();
                const o = JSON.stringify({ selection: sel, productVariations: vars, choiceQuantities: qtys });
                if (this.lastQuote?.valid && this.lastSelection === o && "true" !== this.root.getAttribute("aria-busy")) return;
                e.preventDefault();
                this.hasSubmitted = !0;
                if (this.lastQuote && !this.lastQuote.valid && this.lastSelection === o && "true" !== this.root.getAttribute("aria-busy")) {
                    this.renderQuote(this.lastQuote, !0);
                    return;
                }
                this.requestQuote(!0);
            });
            if (this.form && window.jQuery) {
            const e = () => this.scheduleQuote(50);
            window.jQuery(this.form).on("found_variation.wooptions-pro reset_data.wooptions-pro", e);
        }
            // Re-quote when the main product quantity changes so extendedTotal stays in sync.
            const qtyInput = this.form?.querySelector('input.qty');
            if (qtyInput) {
                qtyInput.addEventListener('change', () => this.scheduleQuote(50));
                qtyInput.addEventListener('input', () => this.scheduleQuote(200));
            }
        }
        countryFlagSvg(country) {
            const c = String(country || 'US').toUpperCase();
            const s = 'border-radius:2px;overflow:hidden;flex-shrink:0;display:block;box-shadow:0 0 1px rgba(0,0,0,0.3);';
            if (c === 'BD') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#006A4E" /><circle cx="9" cy="7" r="4.2" fill="#F42A41" /></svg>';
            if (c === 'US') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#B22234" /><rect y="2.1" width="20" height="2" fill="#FFFFFF" /><rect y="6.3" width="20" height="2" fill="#FFFFFF" /><rect y="10.5" width="20" height="2" fill="#FFFFFF" /><rect width="8" height="7.2" fill="#3C3B6E" /><circle cx="4" cy="3.6" r="1.5" fill="#FFFFFF" /></svg>';
            if (c === 'GB') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#012169" /><path d="M0 0L20 14M20 0L0 14" stroke="#FFFFFF" stroke-width="2.5" /><path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" stroke-width="1.2" /><path d="M10 0v14M0 7h20" stroke="#FFFFFF" stroke-width="4" /><path d="M10 0v14M0 7h20" stroke="#C8102E" stroke-width="2.2" /></svg>';
            if (c === 'CA') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#D80027" /><rect x="5" width="10" height="14" fill="#FFFFFF" /><polygon points="10,2.5 11,5.5 13.5,5 12,7 13.5,8.5 11,8 10.5,11 9.5,11 9,8 6.5,8.5 8,7 6.5,5 9,5.5" fill="#D80027" /></svg>';
            if (c === 'AU') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#00008B" /><circle cx="14" cy="4" r="1" fill="#FFFFFF" /><circle cx="16" cy="7" r="1" fill="#FFFFFF" /><circle cx="13" cy="10" r="1" fill="#FFFFFF" /></svg>';
            if (c === 'DE') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4.66" fill="#000000" /><rect y="4.66" width="20" height="4.66" fill="#DD0000" /><rect y="9.33" width="20" height="4.67" fill="#FFCE00" /></svg>';
            if (c === 'FR') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="6.6" height="14" fill="#002654" /><rect x="6.6" width="6.8" height="14" fill="#FFFFFF" /><rect x="13.4" width="6.6" height="14" fill="#CE1126" /></svg>';
            if (c === 'IT') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="6.6" height="14" fill="#009246" /><rect x="6.6" width="6.8" height="14" fill="#FFFFFF" /><rect x="13.4" width="6.6" height="14" fill="#CE2B37" /></svg>';
            if (c === 'ES') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="3.5" fill="#AA151B" /><rect y="3.5" width="20" height="7" fill="#F1BF00" /><rect y="10.5" width="20" height="3.5" fill="#AA151B" /></svg>';
            if (c === 'NL') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4.66" fill="#AE1C28" /><rect y="4.66" width="20" height="4.66" fill="#FFFFFF" /><rect y="9.33" width="20" height="4.67" fill="#21468B" /></svg>';
            if (c === 'BR') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#009C3B" /><polygon points="10,2 18,7 10,12 2,7" fill="#FEDF00" /><circle cx="10" cy="7" r="2.5" fill="#002776" /></svg>';
            if (c === 'IN') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4.66" fill="#FF9933" /><rect y="4.66" width="20" height="4.66" fill="#FFFFFF" /><rect y="9.33" width="20" height="4.67" fill="#138808" /><circle cx="10" cy="7" r="1.8" fill="#000080" /></svg>';
            if (c === 'CN') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#DE2910" /><polygon points="4,2.5 4.6,4.2 6.2,4.2 4.9,5.2 5.4,6.8 4,5.8 2.6,6.8 3.1,5.2 1.8,4.2 3.4,4.2" fill="#FFDE00" /></svg>';
            if (c === 'JP') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#FFFFFF" /><circle cx="10" cy="7" r="4" fill="#BC002D" /></svg>';
            if (c === 'KR') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#FFFFFF" /><circle cx="10" cy="7" r="3.5" fill="#CD2E3A" /><path d="M10 7a3.5 3.5 0 0 1 0 3.5 3.5 3.5 0 0 0 0-7z" fill="#0047A0" /></svg>';
            if (c === 'MX') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="6.6" height="14" fill="#006847" /><rect x="6.6" width="6.8" height="14" fill="#FFFFFF" /><rect x="13.4" width="6.6" height="14" fill="#CE1126" /><circle cx="10" cy="7" r="1.5" fill="#8B5A2B" /></svg>';
            if (c === 'AE') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect y="0" width="20" height="4.66" fill="#00732F" /><rect y="4.66" width="20" height="4.66" fill="#FFFFFF" /><rect y="9.33" width="20" height="4.67" fill="#000000" /><rect width="5" height="14" fill="#FF0000" /></svg>';
            if (c === 'SA') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#006C35" /><rect x="4" y="6.2" width="12" height="1.6" fill="#FFFFFF" /></svg>';
            if (c === 'SG') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="7" fill="#ED2939" /><rect y="7" width="20" height="7" fill="#FFFFFF" /><circle cx="4.5" cy="3.5" r="2.2" fill="#FFFFFF" /><circle cx="5.2" cy="3.5" r="1.8" fill="#ED2939" /></svg>';
            if (c === 'PK') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="5" height="14" fill="#FFFFFF" /><rect x="5" width="15" height="14" fill="#01411C" /><circle cx="12" cy="7" r="3.2" fill="#FFFFFF" /><circle cx="13" cy="6.4" r="2.7" fill="#01411C" /></svg>';
            if (c === 'ZA') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="7" fill="#E03C31" /><rect y="7" width="20" height="7" fill="#001489" /><polygon points="0,0 8,7 0,14" fill="#000000" /><path d="M0 0l8.5 7-8.5 7h3l7-5.5v-3l-7-5.5z" fill="#FFB81C" /><path d="M8 5.5h12v3h-12z" fill="#007749" /></svg>';
            if (c === 'TR') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#E30A17" /><circle cx="8" cy="7" r="3.5" fill="#FFFFFF" /><circle cx="9" cy="7" r="2.8" fill="#E30A17" /><polygon points="12.5,5.5 13.5,7 15,7 13.8,8 14.2,9.5 13,8.5 11.8,9.5 12.2,8 11,7 12.5,7" fill="#FFFFFF" /></svg>';
            if (c === 'SE') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#005293" /><rect x="6" width="3" height="14" fill="#FECB00" /><rect y="5.5" width="20" height="3" fill="#FECB00" /></svg>';
            if (c === 'CH') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#D52B1E" /><rect x="8.5" y="3" width="3" height="8" fill="#FFFFFF" /><rect x="6" y="5.5" width="8" height="3" fill="#FFFFFF" /></svg>';
            if (c === 'PL') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="7" fill="#FFFFFF" style="' + s + '" /><rect y="7" width="20" height="7" fill="#DC143C" /></svg>';
            if (c === 'AR') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4.66" fill="#74ACDF" /><rect y="4.66" width="20" height="4.66" fill="#FFFFFF" /><rect y="9.33" width="20" height="4.67" fill="#74ACDF" /><circle cx="10" cy="7" r="1.6" fill="#F6B40E" /></svg>';
            if (c === 'BE') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="6.6" height="14" fill="#000000" /><rect x="6.6" width="6.8" height="14" fill="#FDDA24" /><rect x="13.4" width="6.6" height="14" fill="#EF3340" /></svg>';
            if (c === 'AT') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4.66" fill="#ED2939" /><rect y="4.66" width="20" height="4.66" fill="#FFFFFF" /><rect y="9.33" width="20" height="4.67" fill="#ED2939" /></svg>';
            if (c === 'NO') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#BA0C2F" /><rect x="5.5" width="4" height="14" fill="#FFFFFF" /><rect y="5" width="20" height="4" fill="#FFFFFF" /><rect x="6.5" width="2" height="14" fill="#00205B" /><rect y="6" width="20" height="2" fill="#00205B" /></svg>';
            if (c === 'DK') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#C60C30" /><rect x="6" width="2.5" height="14" fill="#FFFFFF" /><rect y="5.7" width="20" height="2.5" fill="#FFFFFF" /></svg>';
            if (c === 'FI') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#FFFFFF" /><rect x="6" width="3" height="14" fill="#002F6C" /><rect y="5.5" width="20" height="3" fill="#002F6C" /></svg>';
            if (c === 'IE') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="6.6" height="14" fill="#169B62" /><rect x="6.6" width="6.8" height="14" fill="#FFFFFF" /><rect x="13.4" width="6.6" height="14" fill="#FF883E" /></svg>';
            if (c === 'NZ') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#00247D" /><circle cx="14" cy="4" r="1.1" fill="#CC142B" /><circle cx="16.5" cy="7" r="1.1" fill="#CC142B" /><circle cx="13" cy="10" r="1.1" fill="#CC142B" /></svg>';
            if (c === 'PT') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="8" height="14" fill="#046A38" /><rect x="8" width="12" height="14" fill="#DA291C" /><circle cx="8" cy="7" r="2.5" fill="#FFE900" /></svg>';
            if (c === 'GR') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#0D5EAF" /><rect y="1.5" width="20" height="1.5" fill="#FFFFFF" /><rect y="4.6" width="20" height="1.5" fill="#FFFFFF" /><rect y="7.7" width="20" height="1.5" fill="#FFFFFF" /><rect y="10.8" width="20" height="1.5" fill="#FFFFFF" /><rect width="7.5" height="7.7" fill="#0D5EAF" /><rect x="3" width="1.5" height="7.7" fill="#FFFFFF" /><rect y="3.1" width="7.5" height="1.5" fill="#FFFFFF" /></svg>';
            if (c === 'IL') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#FFFFFF" /><rect y="1.5" width="20" height="2" fill="#0038B8" /><rect y="10.5" width="20" height="2" fill="#0038B8" /><polygon points="10,4.5 12,8 8,8" stroke="#0038B8" stroke-width="0.7" fill="none" /><polygon points="10,9 12,5.5 8,5.5" stroke="#0038B8" stroke-width="0.7" fill="none" /></svg>';
            if (c === 'HK') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#C8102E" /><circle cx="10" cy="7" r="3" fill="#FFFFFF" /></svg>';
            if (c === 'MY') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#CC0000" /><rect y="2" width="20" height="2" fill="#FFFFFF" /><rect y="6" width="20" height="2" fill="#FFFFFF" /><rect y="10" width="20" height="2" fill="#FFFFFF" /><rect width="10" height="8" fill="#010066" /><circle cx="5" cy="4" r="2.5" fill="#FFCC00" /><circle cx="5.8" cy="4" r="2.1" fill="#010066" /></svg>';
            if (c === 'PH') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="7" fill="#0038A8" style="' + s + '" /><rect y="7" width="20" height="7" fill="#CE1126" /><polygon points="0,0 8,7 0,14" fill="#FFFFFF" /><circle cx="2.8" cy="7" r="1.3" fill="#FCD116" /></svg>';
            if (c === 'ID') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="7" fill="#CE1126" style="' + s + '" /><rect y="7" width="20" height="7" fill="#FFFFFF" /></svg>';
            if (c === 'TH') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#A51931" /><rect y="2.3" width="20" height="9.4" fill="#F4F5F8" /><rect y="4.6" width="20" height="4.8" fill="#2D2A4A" /></svg>';
            if (c === 'VN') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" fill="#DA251D" /><polygon points="10,3.5 11.2,7.2 14.8,7.2 11.9,9.4 13,13 10,10.8 7,13 8.1,9.4 5.2,7.2 8.8,7.2" fill="#FFFF00" /></svg>';
            if (c === 'EG') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4.66" fill="#CE1126" /><rect y="4.66" width="20" height="4.66" fill="#FFFFFF" /><rect y="9.33" width="20" height="4.67" fill="#000000" /><circle cx="10" cy="7" r="1.3" fill="#C09A3E" /></svg>';
            if (c === 'NG') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="6.6" height="14" fill="#008751" /><rect x="6.6" width="6.8" height="14" fill="#FFFFFF" /><rect x="13.4" width="6.6" height="14" fill="#008751" /></svg>';
            if (c === 'KE') return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="4" fill="#000000" /><rect y="4" width="20" height="1" fill="#FFFFFF" /><rect y="5" width="20" height="4" fill="#922529" /><rect y="9" width="20" height="1" fill="#FFFFFF" /><rect y="10" width="20" height="4" fill="#006600" /><ellipse cx="10" cy="7" rx="2" ry="3.5" fill="#922529" /><ellipse cx="10" cy="7" rx="0.5" ry="3.5" fill="#FFFFFF" /></svg>';
            return '<svg class="wof-flag-svg" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" style="' + s + '"><rect width="20" height="14" rx="2" fill="#334155" /><text x="10" y="10" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="7" font-weight="700" fill="#FFFFFF" text-anchor="middle">' + c.slice(0, 2) + '</text></svg>';
        }
        updatePhoneCountry(selectElem) {
            const wrap = selectElem.closest("[data-wof-phone-wrap]");
            if (!wrap) return;
            const option = selectElem.selectedOptions[0];
            if (!option) return;
            const code = option.value;
            const dial = option.dataset.dial || "";
            const countrySlot = wrap.querySelector("[data-wof-country-slot]");
            if (countrySlot) countrySlot.textContent = code;
            const dialSlot = wrap.querySelector("[data-wof-dial-slot]");
            if (dialSlot) dialSlot.textContent = dial;
            const flagSlot = wrap.querySelector("[data-wof-flag-slot]");
            if (flagSlot) flagSlot.innerHTML = this.countryFlagSvg(code);

            wrap.querySelectorAll("[data-wof-phone-option]").forEach(opt => {
                const isSelected = opt.dataset.code === code;
                opt.classList.toggle("is-selected", isSelected);
                opt.setAttribute("aria-selected", isSelected ? "true" : "false");
            });
        }
        closeAllPhonePickers(except = null) {
            document.querySelectorAll("[data-wof-phone-picker].is-open").forEach(elem => {
                if (elem !== except) {
                    elem.classList.remove("is-open");
                    elem.querySelector("[data-wof-phone-trigger]")?.setAttribute("aria-expanded", "false");
                    const search = elem.querySelector("[data-wof-phone-search]");
                    if (search) search.value = "";
                    elem.querySelectorAll("[data-wof-phone-option]").forEach(opt => {
                        opt.classList.remove("is-hidden");
                        opt.classList.remove("is-active");
                        opt.hidden = false;
                        opt.style.removeProperty("display");
                    });
                }
            });
        }
        countryRules() {
            return {
                US: { name: "United States", dial: "+1", min: 10, max: 10 },
                GB: { name: "United Kingdom", dial: "+44", min: 10, max: 11 },
                CA: { name: "Canada", dial: "+1", min: 10, max: 10 },
                AU: { name: "Australia", dial: "+61", min: 9, max: 10 },
                DE: { name: "Germany", dial: "+49", min: 10, max: 11 },
                FR: { name: "France", dial: "+33", min: 9, max: 10 },
                IT: { name: "Italy", dial: "+39", min: 9, max: 10 },
                ES: { name: "Spain", dial: "+34", min: 9, max: 9 },
                NL: { name: "Netherlands", dial: "+31", min: 9, max: 10 },
                BR: { name: "Brazil", dial: "+55", min: 10, max: 11 },
                IN: { name: "India", dial: "+91", min: 10, max: 10 },
                CN: { name: "China", dial: "+86", min: 11, max: 11 },
                JP: { name: "Japan", dial: "+81", min: 10, max: 11 },
                KR: { name: "South Korea", dial: "+82", min: 9, max: 11 },
                MX: { name: "Mexico", dial: "+52", min: 10, max: 10 },
                AE: { name: "United Arab Emirates", dial: "+971", min: 9, max: 9 },
                SA: { name: "Saudi Arabia", dial: "+966", min: 9, max: 9 },
                SG: { name: "Singapore", dial: "+65", min: 8, max: 8 },
                BD: { name: "Bangladesh", dial: "+880", min: 10, max: 11 },
                PK: { name: "Pakistan", dial: "+92", min: 10, max: 11 },
                ZA: { name: "South Africa", dial: "+27", min: 9, max: 10 },
                TR: { name: "Turkey", dial: "+90", min: 10, max: 10 },
                SE: { name: "Sweden", dial: "+46", min: 9, max: 10 },
                CH: { name: "Switzerland", dial: "+41", min: 9, max: 9 },
                PL: { name: "Poland", dial: "+48", min: 9, max: 9 },
                AR: { name: "Argentina", dial: "+54", min: 10, max: 10 },
                BE: { name: "Belgium", dial: "+32", min: 9, max: 9 },
                AT: { name: "Austria", dial: "+43", min: 10, max: 11 },
                NO: { name: "Norway", dial: "+47", min: 8, max: 8 },
                DK: { name: "Denmark", dial: "+45", min: 8, max: 8 },
                FI: { name: "Finland", dial: "+358", min: 9, max: 10 },
                IE: { name: "Ireland", dial: "+353", min: 9, max: 9 },
                NZ: { name: "New Zealand", dial: "+64", min: 8, max: 10 },
                PT: { name: "Portugal", dial: "+351", min: 9, max: 9 },
                GR: { name: "Greece", dial: "+30", min: 10, max: 10 },
                IL: { name: "Israel", dial: "+972", min: 9, max: 10 },
                HK: { name: "Hong Kong", dial: "+852", min: 8, max: 8 },
                MY: { name: "Malaysia", dial: "+60", min: 9, max: 10 },
                PH: { name: "Philippines", dial: "+63", min: 10, max: 10 },
                ID: { name: "Indonesia", dial: "+62", min: 10, max: 12 },
                TH: { name: "Thailand", dial: "+66", min: 9, max: 10 },
                VN: { name: "Vietnam", dial: "+84", min: 9, max: 10 },
                EG: { name: "Egypt", dial: "+20", min: 10, max: 10 },
                NG: { name: "Nigeria", dial: "+234", min: 10, max: 11 },
                KE: { name: "Kenya", dial: "+254", min: 9, max: 10 }
            };
        }
        getPhoneCountryRule(code) {
            const rules = this.countryRules();
            return rules[String(code || "US").toUpperCase()] || { name: "International", dial: "", min: 7, max: 15 };
        }
        initCustomSelects() {
            this.root.querySelectorAll("[data-wof-custom-select]").forEach(cs => {
                this.syncCustomSelect(cs);
            });
        }
        syncCustomSelect(customSelect, activeOption = null) {
            if (!customSelect) return;
            const nativeSelect = customSelect.querySelector("select");
            if (!nativeSelect) return;

            const options = Array.from(customSelect.querySelectorAll(".wof-custom-select__option"));
            const targetOption = activeOption || options.find(opt => (opt.dataset.wofOptionValue ?? "") === nativeSelect.value) || options[0];

            options.forEach(opt => {
                const isSelected = opt === targetOption;
                opt.classList.toggle("is-selected", isSelected);
                opt.setAttribute("aria-selected", isSelected ? "true" : "false");
            });

            const imgSlot = customSelect.querySelector("[data-wof-selected-img]");
            const titleSlot = customSelect.querySelector("[data-wof-selected-title]");
            const priceSlot = customSelect.querySelector("[data-wof-selected-price]");

            if (targetOption) {
                const img = targetOption.dataset.wofOptionImage || "";
                const label = targetOption.dataset.wofOptionLabel || targetOption.querySelector(".wof-custom-select__option-label")?.textContent?.trim() || "";
                const price = targetOption.dataset.wofOptionPrice || "";
                const fontFamily = targetOption.dataset.fontFamily || "";

                if (imgSlot) {
                    if (img) {
                        imgSlot.src = img;
                        imgSlot.style.display = "";
                    } else {
                        imgSlot.src = "";
                        imgSlot.style.display = "none";
                    }
                }
                if (titleSlot) {
                    titleSlot.textContent = label;
                    if (fontFamily) {
                        titleSlot.style.fontFamily = fontFamily;
                    } else if (customSelect.classList.contains("wof-custom-select--font")) {
                        titleSlot.style.fontFamily = "";
                    }
                }
                if (priceSlot) {
                    if (price) {
                        priceSlot.textContent = price;
                        priceSlot.style.display = "";
                    } else {
                        priceSlot.textContent = "";
                        priceSlot.style.display = "none";
                    }
                }

                const fieldContainer = customSelect.closest("[data-wof-font-picker], [data-wof-type='font']");
                if (fieldContainer) {
                    let appliedFields = [];
                    try {
                        appliedFields = JSON.parse(fieldContainer.dataset.wofAppliedFields || "[]");
                    } catch {
                        appliedFields = [];
                    }
                    if (Array.isArray(appliedFields) && appliedFields.length > 0) {
                        if (fontFamily) {
                            this.ensureFontLoaded(fontFamily);
                        }
                        appliedFields.forEach(targetUuid => {
                            if (!targetUuid) return;
                            const safeId = String(targetUuid).trim();
                            const targetField = this.root.querySelector(`[data-wof-field="${safeId}"]`)
                                || this.root.querySelector(`[data-wof-field="${r(safeId)}"]`)
                                || document.querySelector(`[data-wof-field="${safeId}"]`);
                            if (targetField) {
                                if (fontFamily) {
                                    targetField.style.setProperty("font-family", fontFamily, "important");
                                    targetField.querySelectorAll('input, textarea').forEach(inp => {
                                        inp.style.setProperty("font-family", fontFamily, "important");
                                    });
                                } else {
                                    targetField.style.removeProperty("font-family");
                                    targetField.querySelectorAll('input, textarea').forEach(inp => {
                                        inp.style.removeProperty("font-family");
                                    });
                                }
                            }
                        });
                    }
                }
            }
        }
        ensureFontLoaded(family) {
            if (!family || typeof family !== "string") return;
            const cleanName = family.split(",")[0].replace(/['"]/g, "").trim();
            if (!cleanName) return;
            const systemFonts = ["inherit", "initial", "sans-serif", "serif", "monospace", "cursive", "fantasy", "arial", "helvetica", "georgia", "times new roman", "courier new", "verdana", "tahoma", "trebuchet ms", "impact"];
            if (systemFonts.includes(cleanName.toLowerCase())) return;

            // Check if this font family is already defined by @font-face (e.g. custom uploaded font)
            const isCustomFontFace = Array.from(document.styleSheets).some(sheet => {
                try {
                    return Array.from(sheet.cssRules || []).some(rule => {
                        return rule.type === CSSRule.FONT_FACE_RULE && (rule.style?.fontFamily || "").replace(/['"]/g, "").trim().toLowerCase() === cleanName.toLowerCase();
                    });
                } catch { return false; }
            });
            if (isCustomFontFace) return;

            const linkId = "wof-gf-" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-");
            if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(cleanName).replace(/%20/g, "+") + ":wght@400;700&display=swap";
                document.head.appendChild(link);
            }
        }
        closeAllCustomSelects(except = null) {
            document.querySelectorAll("[data-wof-custom-select].is-open").forEach(cs => {
                if (cs !== except) {
                    cs.classList.remove("is-open");
                    cs.querySelector("[data-wof-custom-select-trigger]")?.setAttribute("aria-expanded", "false");
                }
            });
        }
        initCustomDateTimes() {
            this.root.querySelectorAll("[data-wof-custom-datetime]").forEach(elem => {
                this.syncCustomDateTime(elem);
            });
        }
        syncCustomDateTime(elem) {
            const hiddenInput = elem.querySelector("[data-wof-datetime-value]");
            if (!hiddenInput) return;
            const config = this.getDateTimeConfig(elem);
            const val = hiddenInput.value.trim();
            if (!val) return;
            if (config.type === 'date') {
                const display = elem.querySelector('[data-wof-datetime-display="date"]');
                if (display) display.textContent = this.formatDateDisplay(val, config.dateFormat, config.wpDateFormat);
            } else if (config.type === 'time') {
                const display = elem.querySelector('[data-wof-datetime-display="time"]');
                if (display) display.textContent = val;
            } else {
                const parts = val.split(' ');
                if (parts[0]) {
                    const dDisplay = elem.querySelector('[data-wof-datetime-display="date"]');
                    if (dDisplay) dDisplay.textContent = this.formatDateDisplay(parts[0], config.dateFormat, config.wpDateFormat);
                }
                const timeStr = parts.slice(1).join(' ');
                if (timeStr) {
                    const tDisplay = elem.querySelector('[data-wof-datetime-display="time"]');
                    if (tDisplay) tDisplay.textContent = timeStr;
                }
            }
        }
        getDateTimeConfig(elem) {
            try {
                return JSON.parse(elem.dataset.wofDatetimeConfig || "{}");
            } catch {
                return {};
            }
        }
        closeAllCustomDateTimes(except = null) {
            document.querySelectorAll("[data-wof-custom-datetime].is-open").forEach(elem => {
                if (elem !== except) {
                    elem.classList.remove("is-open");
                    elem.querySelectorAll("[data-wof-datetime-trigger]").forEach(t => t.setAttribute("aria-expanded", "false"));
                }
            });
        }
        toggleCustomDateTime(trigger) {
            const container = trigger.closest("[data-wof-custom-datetime]");
            if (!container) return;
            const mode = trigger.dataset.wofDatetimeTrigger || "date";
            const dropdown = container.querySelector("[data-wof-datetime-dropdown]");
            if (!dropdown) return;
            const isCurrentlyOpen = container.classList.contains("is-open") && container.dataset.wofActiveMode === mode;
            if (isCurrentlyOpen) {
                this.closeAllCustomDateTimes();
                return;
            }
            this.closeAllCustomDateTimes(container);
            this.closeAllCustomSelects();
            container.classList.add("is-open");
            container.dataset.wofActiveMode = mode;
            trigger.setAttribute("aria-expanded", "true");

            const isDual = Boolean(container.querySelector(".wof-custom-datetime__dual"));
            const isRtl = document.documentElement.dir === "rtl" || document.body.classList.contains("rtl");
            if (isDual) {
                if (mode === "time") {
                    dropdown.style.left = isRtl ? "0" : "auto";
                    dropdown.style.right = isRtl ? "auto" : "0";
                } else {
                    dropdown.style.left = isRtl ? "auto" : "0";
                    dropdown.style.right = isRtl ? "0" : "auto";
                }
            } else {
                dropdown.style.left = isRtl ? "auto" : "0";
                dropdown.style.right = isRtl ? "0" : "auto";
            }

            const config = this.getDateTimeConfig(container);
            if (mode === "date") {
                this.openCalendar(container, dropdown, config);
            } else {
                this.openTimePicker(container, dropdown, config);
            }
        }
        openCalendar(container, dropdown, config, viewDate = null) {
            const hiddenInput = container.querySelector("[data-wof-datetime-value]");
            const currentVal = hiddenInput ? hiddenInput.value.split(" ")[0] : "";
            const activeDate = currentVal && !isNaN(new Date(currentVal).getTime()) ? new Date(currentVal) : new Date();
            const dateToView = viewDate || activeDate;
            const year = dateToView.getFullYear();
            const month = dateToView.getMonth();

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

            const firstDayIndex = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const prevMonthDays = new Date(year, month, 0).getDate();

            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            let html = '<div class="wof-calendar">';
            html += '<div class="wof-calendar-header">';
            html += '<button type="button" class="wof-calendar-nav is-prev" aria-label="Previous month"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>';
            html += `<span class="wof-calendar-title">${monthNames[month]} ${year}</span>`;
            html += '<button type="button" class="wof-calendar-nav is-next" aria-label="Next month"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>';
            html += '</div>';

            html += '<div class="wof-calendar-weekdays">';
            dayNames.forEach(d => { html += `<span>${d}</span>`; });
            html += '</div>';

            html += '<div class="wof-calendar-days">';
            for (let i = firstDayIndex - 1; i >= 0; i--) {
                const dayNum = prevMonthDays - i;
                html += `<span class="wof-calendar-day is-other-month is-disabled">${dayNum}</span>`;
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isDisabled = this.isDateDisabled(dateStr, year, month, day, config);
                const isSelected = currentVal === dateStr;
                const isToday = dateStr === todayStr;
                const classes = ["wof-calendar-day"];
                if (isDisabled) classes.push("is-disabled");
                if (isSelected) classes.push("is-selected");
                if (isToday) classes.push("is-today");

                html += `<button type="button" class="${classes.join(' ')}" data-wof-cal-date="${dateStr}" ${isDisabled ? 'disabled' : ''}>${day}</button>`;
            }
            html += '</div>';
            html += '</div>';

            dropdown.innerHTML = html;

            dropdown.querySelector(".is-prev")?.addEventListener("click", e => {
                e.stopPropagation();
                this.openCalendar(container, dropdown, config, new Date(year, month - 1, 1));
            });
            dropdown.querySelector(".is-next")?.addEventListener("click", e => {
                e.stopPropagation();
                this.openCalendar(container, dropdown, config, new Date(year, month + 1, 1));
            });
            dropdown.querySelectorAll("[data-wof-cal-date]").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    const selectedDate = btn.dataset.wofCalDate;
                    this.onDateSelected(container, selectedDate, config);
                });
            });
        }
        isDateDisabled(dateStr, year, month, day, config) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const curDate = new Date(year, month, day);
            curDate.setHours(0, 0, 0, 0);

            if (config.minDateType === "current_day" && curDate < today) return true;
            if (config.minDateType === "custom" && config.minDateCustom) {
                const minCustom = this.parseDateString(config.minDateCustom);
                if (minCustom && curDate < minCustom) return true;
            }

            if (config.maxDateType === "current_day" && curDate > today) return true;
            if (config.maxDateType === "custom" && config.maxDateCustom) {
                const maxCustom = this.parseDateString(config.maxDateCustom);
                if (maxCustom && curDate > maxCustom) return true;
            }

            if (config.disableToday && curDate.getTime() === today.getTime()) return true;

            if (config.disableNextNDays > 0) {
                const diffTime = curDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 1 && diffDays <= config.disableNextNDays) return true;
            }

            if (Array.isArray(config.disabledDates) && config.disabledDates.includes(dateStr)) return true;

            const dayOfWeek = curDate.getDay();
            if (Array.isArray(config.disabledWeekdays) && config.disabledWeekdays.includes(dayOfWeek)) return true;

            if (config.disabledMonthlyDays) {
                const days = String(config.disabledMonthlyDays).split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                if (days.includes(day)) return true;
            }

            return false;
        }
        parseDateString(str) {
            if (!str) return null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                const [y, m, d] = str.split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
                const [d, m, y] = str.split('/').map(Number);
                return new Date(y, m - 1, d);
            }
            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
                const [m, d, y] = str.split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            const parsed = new Date(str);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        formatDateDisplay(dateStr, format = "DD/MM/YYYY", wpFormat = "") {
            if (!dateStr) return "";
            const d = this.parseDateString(dateStr) || new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = String(d.getDate()).padStart(2, '0');
            const daySingle = String(d.getDate());
            const monthNum = String(d.getMonth() + 1).padStart(2, '0');
            const year = String(d.getFullYear());
            const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const longMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const shortMonth = shortMonths[d.getMonth()];
            const longMonth = longMonths[d.getMonth()];

            if (format === "MMM DD, YYYY") return `${shortMonth} ${day}, ${year}`;
            if (format === "DD/MM/YYYY") return `${day}/${monthNum}/${year}`;
            if (format === "MM/DD/YYYY") return `${monthNum}/${day}/${year}`;
            if (format === "YYYY-MM-DD") return `${year}-${monthNum}-${day}`;
            if (format === "DD MMMM, YYYY") return `${daySingle} ${longMonth}, ${year}`;
            if (format === "D.MM.YYYY") return `${daySingle}.${monthNum}.${year}`;
            if (format === "wp_default") return `${shortMonth} ${daySingle}, ${year}`;
            return `${day}/${monthNum}/${year}`;
        }
        onDateSelected(container, selectedDate, config) {
            const hiddenInput = container.querySelector("[data-wof-datetime-value]");
            const dateDisplay = container.querySelector('[data-wof-datetime-display="date"]');
            if (dateDisplay) {
                dateDisplay.textContent = this.formatDateDisplay(selectedDate, config.dateFormat, config.wpDateFormat);
            }
            let newVal = selectedDate;
            if (config.type === "datetime") {
                const currentVal = hiddenInput ? hiddenInput.value : "";
                const existingTime = currentVal.includes(" ") ? currentVal.split(" ").slice(1).join(" ") : (config.timeFormat === "24" ? "12:00" : "12:00 PM");
                newVal = `${selectedDate} ${existingTime}`;
                const timeDisplay = container.querySelector('[data-wof-datetime-display="time"]');
                if (timeDisplay && !currentVal.includes(" ")) {
                    timeDisplay.textContent = existingTime;
                    const dropdown = container.querySelector("[data-wof-datetime-dropdown]");
                    if (dropdown) {
                        this.openTimePicker(container, dropdown, config);
                        container.dataset.wofActiveMode = "time";
                        return;
                    }
                }
            }
            if (hiddenInput) {
                hiddenInput.value = newVal;
                hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
            this.closeAllCustomDateTimes();
            this.selectionChanged(hiddenInput);
        }
        openTimePicker(container, dropdown, config) {
            const hiddenInput = container.querySelector("[data-wof-datetime-value]");
            const currentVal = hiddenInput ? hiddenInput.value : "";
            let timeVal = config.type === "datetime" && currentVal.includes(" ") ? currentVal.split(" ").slice(1).join(" ") : currentVal;
            if (!timeVal) timeVal = config.timeFormat === "24" ? "12:00" : "12:00 PM";

            const is12 = config.timeFormat !== "24";
            const match = timeVal.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
            let hours = match ? parseInt(match[1], 10) : 12;
            let minutes = match ? parseInt(match[2], 10) : 0;
            let meridiem = match && match[3] ? match[3].toUpperCase() : "AM";

            const hoursRange = is12 ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 24 }, (_, i) => i);
            const minutesSteps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

            let html = '<div class="wof-timepicker">';
            html += '<div class="wof-timepicker-header"><span>Select Time</span></div>';
            html += '<div class="wof-timepicker-body">';

            html += '<div class="wof-timepicker-col">';
            html += '<span class="wof-timepicker-col-title">Hour</span>';
            html += '<div class="wof-timepicker-list is-hours">';
            hoursRange.forEach(h => {
                const isSelected = h === hours;
                html += `<button type="button" class="wof-timepicker-btn ${isSelected ? 'is-selected' : ''}" data-wof-time-hour="${h}">${String(h).padStart(2, '0')}</button>`;
            });
            html += '</div></div>';

            html += '<div class="wof-timepicker-col">';
            html += '<span class="wof-timepicker-col-title">Minute</span>';
            html += '<div class="wof-timepicker-list is-minutes">';
            minutesSteps.forEach(m => {
                const isSelected = m === minutes;
                html += `<button type="button" class="wof-timepicker-btn ${isSelected ? 'is-selected' : ''}" data-wof-time-min="${m}">${String(m).padStart(2, '0')}</button>`;
            });
            html += '</div></div>';

            if (is12) {
                html += '<div class="wof-timepicker-col is-ampm">';
                html += '<span class="wof-timepicker-col-title">Period</span>';
                html += '<div class="wof-timepicker-list is-ampm-list">';
                html += `<button type="button" class="wof-timepicker-btn ${meridiem === 'AM' ? 'is-selected' : ''}" data-wof-time-mer="AM">AM</button>`;
                html += `<button type="button" class="wof-timepicker-btn ${meridiem === 'PM' ? 'is-selected' : ''}" data-wof-time-mer="PM">PM</button>`;
                html += '</div></div>';
            }

            html += '</div>';
            html += '<div class="wof-timepicker-footer">';
            html += '<button type="button" class="wof-timepicker-apply-btn" data-wof-time-apply>Apply Time</button>';
            html += '</div>';
            html += '</div>';

            dropdown.innerHTML = html;

            let curH = hours;
            let curM = minutes;
            let curMer = meridiem;

            dropdown.querySelectorAll("[data-wof-time-hour]").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    dropdown.querySelectorAll("[data-wof-time-hour]").forEach(b => b.classList.remove("is-selected"));
                    btn.classList.add("is-selected");
                    curH = parseInt(btn.dataset.wofTimeHour, 10);
                });
            });
            dropdown.querySelectorAll("[data-wof-time-min]").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    dropdown.querySelectorAll("[data-wof-time-min]").forEach(b => b.classList.remove("is-selected"));
                    btn.classList.add("is-selected");
                    curM = parseInt(btn.dataset.wofTimeMin, 10);
                });
            });
            dropdown.querySelectorAll("[data-wof-time-mer]").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    dropdown.querySelectorAll("[data-wof-time-mer]").forEach(b => b.classList.remove("is-selected"));
                    btn.classList.add("is-selected");
                    curMer = btn.dataset.wofTimeMer;
                });
            });
            dropdown.querySelector("[data-wof-time-apply]")?.addEventListener("click", e => {
                e.stopPropagation();
                const formattedTime = is12
                    ? `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')} ${curMer}`
                    : `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
                this.onTimeSelected(container, formattedTime, config);
            });
        }
        onTimeSelected(container, selectedTime, config) {
            const hiddenInput = container.querySelector("[data-wof-datetime-value]");
            const timeDisplay = container.querySelector('[data-wof-datetime-display="time"]');
            if (timeDisplay) {
                timeDisplay.textContent = selectedTime;
            }
            let newVal = selectedTime;
            if (config.type === "datetime") {
                const currentVal = hiddenInput ? hiddenInput.value : "";
                const existingDate = currentVal.includes(" ") ? currentVal.split(" ")[0] : "";
                newVal = existingDate ? `${existingDate} ${selectedTime}` : selectedTime;
            }
            if (hiddenInput) {
                hiddenInput.value = newVal;
                hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
            this.closeAllCustomDateTimes();
            this.selectionChanged(hiddenInput);
        }
        initCustomDateRanges() {
            this.root.querySelectorAll("[data-wof-custom-daterange]").forEach(elem => {
                this.syncCustomDateRange(elem);
            });
        }
        syncCustomDateRange(elem) {
            const startInput = elem.querySelector("[data-wof-daterange-start]");
            const endInput = elem.querySelector("[data-wof-daterange-end]");
            const config = this.getDateRangeConfig(elem);
            if (startInput && startInput.value) {
                const sDisplay = elem.querySelector('[data-wof-daterange-display="start"]');
                if (sDisplay) sDisplay.textContent = this.formatDateDisplay(startInput.value, config.dateFormat, config.wpDateFormat);
            }
            if (endInput && endInput.value) {
                const eDisplay = elem.querySelector('[data-wof-daterange-display="end"]');
                if (eDisplay) eDisplay.textContent = this.formatDateDisplay(endInput.value, config.dateFormat, config.wpDateFormat);
            }
        }
        getDateRangeConfig(elem) {
            try {
                return JSON.parse(elem.dataset.wofDaterangeConfig || "{}");
            } catch {
                return {};
            }
        }
        closeAllCustomDateRanges(except = null) {
            document.querySelectorAll("[data-wof-custom-daterange].is-open").forEach(elem => {
                if (elem !== except) {
                    elem.classList.remove("is-open");
                    elem.querySelectorAll("[data-wof-daterange-trigger]").forEach(t => t.setAttribute("aria-expanded", "false"));
                }
            });
        }
        toggleCustomDateRange(trigger) {
            const container = trigger.closest("[data-wof-custom-daterange]");
            if (!container) return;
            const mode = trigger.dataset.wofDaterangeTrigger || "start";
            const dropdown = container.querySelector("[data-wof-daterange-dropdown]");
            if (!dropdown) return;
            const isCurrentlyOpen = container.classList.contains("is-open") && container.dataset.wofActiveRangeMode === mode;
            if (isCurrentlyOpen) {
                this.closeAllCustomDateRanges();
                return;
            }
            this.closeAllCustomDateRanges(container);
            this.closeAllCustomDateTimes();
            this.closeAllCustomSelects();
            container.classList.add("is-open");
            container.dataset.wofActiveRangeMode = mode;
            container.querySelectorAll("[data-wof-daterange-trigger]").forEach(t => {
                t.setAttribute("aria-expanded", t === trigger ? "true" : "false");
            });

            const isRtl = document.documentElement.dir === "rtl" || document.body.classList.contains("rtl");
            if (mode === "end") {
                dropdown.style.left = isRtl ? "0" : "auto";
                dropdown.style.right = isRtl ? "auto" : "0";
            } else {
                dropdown.style.left = isRtl ? "auto" : "0";
                dropdown.style.right = isRtl ? "0" : "auto";
            }

            const config = this.getDateRangeConfig(container);
            this.openDateRangeCalendar(container, dropdown, config, null, mode);
        }
        openDateRangeCalendar(container, dropdown, config, viewDate = null, activeMode = "start") {
            const startInput = container.querySelector("[data-wof-daterange-start]");
            const endInput = container.querySelector("[data-wof-daterange-end]");
            const startVal = startInput ? startInput.value : "";
            const endVal = endInput ? endInput.value : "";

            let dateToView = viewDate;
            if (!dateToView) {
                if (activeMode === "end" && endVal) {
                    dateToView = this.parseDateString(endVal);
                } else if (startVal) {
                    dateToView = this.parseDateString(startVal);
                }
            }
            if (!dateToView || isNaN(dateToView.getTime())) {
                dateToView = new Date();
            }

            const year = dateToView.getFullYear();
            const month = dateToView.getMonth();

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

            const firstDayIndex = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const prevMonthDays = new Date(year, month, 0).getDate();

            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            let html = '<div class="wof-calendar">';
            html += '<div class="wof-calendar-header">';
            html += '<button type="button" class="wof-calendar-nav is-prev" aria-label="Previous month"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>';
            html += `<span class="wof-calendar-title">${monthNames[month]} ${year}</span>`;
            html += '<button type="button" class="wof-calendar-nav is-next" aria-label="Next month"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>';
            html += '</div>';

            html += '<div class="wof-calendar-weekdays">';
            dayNames.forEach(d => { html += `<span>${d}</span>`; });
            html += '</div>';

            html += '<div class="wof-calendar-days">';
            for (let i = firstDayIndex - 1; i >= 0; i--) {
                const dayNum = prevMonthDays - i;
                html += `<span class="wof-calendar-day is-other-month is-disabled">${dayNum}</span>`;
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isDisabled = this.isDateRangeDateDisabled(dateStr, year, month, day, config, activeMode, startVal, endVal);
                const isToday = dateStr === todayStr;
                const isStart = dateStr === startVal;
                const isEnd = dateStr === endVal;
                const isInRange = startVal && endVal && dateStr > startVal && dateStr < endVal;

                const classes = ["wof-calendar-day"];
                if (isDisabled) classes.push("is-disabled");
                if (isStart) classes.push("is-range-start", "is-selected");
                if (isEnd) classes.push("is-range-end", "is-selected");
                if (isInRange) classes.push("is-in-range");
                if (isToday) classes.push("is-today");

                html += `<button type="button" class="${classes.join(' ')}" data-wof-cal-date="${dateStr}" ${isDisabled ? 'disabled' : ''}>${day}</button>`;
            }
            html += '</div>';
            html += '</div>';

            dropdown.innerHTML = html;

            dropdown.querySelector(".is-prev")?.addEventListener("click", e => {
                e.stopPropagation();
                this.openDateRangeCalendar(container, dropdown, config, new Date(year, month - 1, 1), activeMode);
            });
            dropdown.querySelector(".is-next")?.addEventListener("click", e => {
                e.stopPropagation();
                this.openDateRangeCalendar(container, dropdown, config, new Date(year, month + 1, 1), activeMode);
            });
            dropdown.querySelectorAll("[data-wof-cal-date]").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    const selectedDate = btn.dataset.wofCalDate;
                    this.onDateRangeSelected(container, selectedDate, config, activeMode);
                });

                if (activeMode === "end" && startVal) {
                    btn.addEventListener("mouseenter", () => {
                        const hoveredDate = btn.dataset.wofCalDate;
                        if (!hoveredDate || hoveredDate <= startVal) return;
                        dropdown.querySelectorAll("[data-wof-cal-date]").forEach(cell => {
                            const d = cell.dataset.wofCalDate;
                            if (d > startVal && d < hoveredDate && !cell.classList.contains("is-disabled")) {
                                cell.classList.add("is-in-range-preview");
                            } else {
                                cell.classList.remove("is-in-range-preview");
                            }
                        });
                    });
                }
            });

            if (activeMode === "end" && startVal) {
                dropdown.querySelector(".wof-calendar-days")?.addEventListener("mouseleave", () => {
                    dropdown.querySelectorAll(".is-in-range-preview").forEach(cell => {
                        cell.classList.remove("is-in-range-preview");
                    });
                });
            }
        }
        isDateRangeDateDisabled(dateStr, year, month, day, config, activeMode, startVal, endVal) {
            if (this.isDateDisabled(dateStr, year, month, day, config)) return true;

            const curDate = new Date(year, month, day);
            curDate.setHours(0, 0, 0, 0);

            if (activeMode === "end" && startVal) {
                const startDate = this.parseDateString(startVal);
                if (startDate) {
                    startDate.setHours(0, 0, 0, 0);
                    if (!config.allowSameDay && curDate.getTime() <= startDate.getTime()) return true;
                    if (config.allowSameDay && curDate.getTime() < startDate.getTime()) return true;

                    const diffMs = curDate.getTime() - startDate.getTime();
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

                    if (config.minDays > 0 && diffDays < config.minDays) return true;
                    if (config.maxDays > 0 && diffDays > config.maxDays) return true;
                }
            } else if (activeMode === "start" && endVal) {
                const endDate = this.parseDateString(endVal);
                if (endDate) {
                    endDate.setHours(0, 0, 0, 0);
                    if (!config.allowSameDay && curDate.getTime() >= endDate.getTime()) return true;
                    if (config.allowSameDay && curDate.getTime() > endDate.getTime()) return true;

                    const diffMs = endDate.getTime() - curDate.getTime();
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

                    if (config.minDays > 0 && diffDays < config.minDays) return true;
                    if (config.maxDays > 0 && diffDays > config.maxDays) return true;
                }
            }

            return false;
        }
        onDateRangeSelected(container, selectedDate, config, activeMode) {
            const startInput = container.querySelector("[data-wof-daterange-start]");
            const endInput = container.querySelector("[data-wof-daterange-end]");
            const startDisplay = container.querySelector('[data-wof-daterange-display="start"]');
            const endDisplay = container.querySelector('[data-wof-daterange-display="end"]');
            const dropdown = container.querySelector("[data-wof-daterange-dropdown]");

            let startVal = startInput ? startInput.value : "";
            let endVal = endInput ? endInput.value : "";

            if (activeMode === "start") {
                startVal = selectedDate;
                if (startInput) startInput.value = startVal;
                if (startDisplay) {
                    startDisplay.textContent = this.formatDateDisplay(startVal, config.dateFormat, config.wpDateFormat);
                }

                let needNewEnd = false;
                if (endVal) {
                    const sDate = this.parseDateString(startVal);
                    const eDate = this.parseDateString(endVal);
                    if (sDate && eDate) {
                        const diffDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        if ((!config.allowSameDay && eDate <= sDate) || (config.allowSameDay && eDate < sDate) ||
                            (config.minDays > 0 && diffDays < config.minDays) ||
                            (config.maxDays > 0 && diffDays > config.maxDays)) {
                            needNewEnd = true;
                        }
                    } else {
                        needNewEnd = true;
                    }
                } else {
                    needNewEnd = true;
                }

                if (needNewEnd) {
                    endVal = "";
                    if (endInput) endInput.value = "";
                    if (endDisplay) {
                        endDisplay.textContent = endDisplay.dataset.wofPlaceholder || (config.dateFormat === "wp_default" ? "Jul 30, 2025" : (config.dateFormat || "DD/MM/YYYY"));
                    }
                    container.dataset.wofActiveRangeMode = "end";
                    const isRtl = document.documentElement.dir === "rtl" || document.body.classList.contains("rtl");
                    if (dropdown) {
                        dropdown.style.left = isRtl ? "0" : "auto";
                        dropdown.style.right = isRtl ? "auto" : "0";
                    }
                    const startTrigger = container.querySelector('[data-wof-daterange-trigger="start"]');
                    const endTrigger = container.querySelector('[data-wof-daterange-trigger="end"]');
                    startTrigger?.setAttribute("aria-expanded", "false");
                    endTrigger?.setAttribute("aria-expanded", "true");
                    if (dropdown) {
                        this.openDateRangeCalendar(container, dropdown, config, this.parseDateString(startVal), "end");
                    }
                    return;
                }

                if (startInput) startInput.dispatchEvent(new Event("change", { bubbles: true }));
                this.closeAllCustomDateRanges();
                this.selectionChanged(startInput);
            } else {
                endVal = selectedDate;
                if (endInput) endInput.value = endVal;
                if (endDisplay) {
                    endDisplay.textContent = this.formatDateDisplay(endVal, config.dateFormat, config.wpDateFormat);
                }

                if (startInput) startInput.dispatchEvent(new Event("change", { bubbles: true }));
                if (endInput) endInput.dispatchEvent(new Event("change", { bubbles: true }));
                this.closeAllCustomDateRanges();
                this.selectionChanged(startInput || endInput);
            }
        }
        selectionChanged(e) {
            this.updateColorOutputs(), this.updateProductImage(e), this.enforceMaxChoices();
            const fieldEl = e.closest("[data-wof-field]");
            if (fieldEl) {
                const type = fieldEl.dataset.wofType || e.type || "";
                if (type === "email" || type === "url" || type === "tel" || e.type === "email" || e.type === "url" || e.type === "tel" || e.classList?.contains("wof-phone-number-input") || e.matches?.("[data-wof-phone-select]")) {
                    const err = this.validateSingleField(fieldEl);
                    if (!err) {
                        this.clearFieldError(fieldEl);
                    } else if (this.hasSubmitted) {
                        this.setFieldError(fieldEl, this.errorText(err.code, err.label, err.params));
                    }
                } else {
                    this.clearFieldError(fieldEl);
                }
            }
            this.scheduleQuote();
            if (!this.interactionRecorded) {
                this.interactionRecorded = !0;
                const t = e.closest("[data-wof-field]"), r = { setUuid: this.configuration.setUuid, revisionUuid: this.configuration.revisionUuid, variationId: this.variationId(), token: this.payload.token, fieldUuid: t?.dataset.wofField ?? "", choiceUuid: e.matches('input[type="radio"],input[type="checkbox"]') && /^[0-9a-f-]{36}$/i.test(e.value) ? e.value : "" };
                fetch(`${o}products/${this.productId()}/interaction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r), credentials: "same-origin" }).catch(() => { });
            }
        }
        enforceMaxChoices() {
            this.root.querySelectorAll("[data-wof-max-choices]").forEach(fieldElem => {
                const max = Number(fieldElem.dataset.wofMaxChoices || 0);
                if (max <= 0) return;
                const checkboxes = Array.from(fieldElem.querySelectorAll('input[type="checkbox"]'));
                if (!checkboxes.length) return;
                const checked = checkboxes.filter(cb => cb.checked);
                const limitReached = checked.length >= max;
                checkboxes.forEach(cb => {
                    if (!cb.checked && "true" !== cb.dataset.wofFixedDisabled) {
                        cb.disabled = limitReached;
                        cb.closest("label")?.classList.toggle("is-choice-disabled", limitReached);
                    } else if (cb.checked) {
                        cb.disabled = false;
                        cb.closest("label")?.classList.remove("is-choice-disabled");
                    }
                });
            });
        }
        readProductVariations() {
            const productVariations = {};
            this.root.querySelectorAll(".wof-product-variation-select").forEach(sel => {
                if (sel.closest("[hidden]") || sel.closest(".is-disabled")) return;
                const choiceUuid = sel.dataset.wofChoiceUuid || (sel.name.match(/_var\[([a-zA-Z0-9_-]+)\]/) || [])[1] || "";
                if (choiceUuid && sel.value) {
                    productVariations[choiceUuid] = sel.value;
                }
            });
            return productVariations;
        }
        readChoiceQuantities() {
            const choiceQuantities = {};
            this.root.querySelectorAll(".wof-choice-qty-input").forEach(inp => {
                if (inp.closest("[hidden]") || inp.closest(".is-disabled")) return;
                const choiceUuid = inp.dataset.wofChoiceUuid || (inp.name.match(/_qty\[([a-zA-Z0-9_-]+)\]/) || [])[1] || "";
                if (choiceUuid && inp.value) {
                    choiceQuantities[choiceUuid] = inp.value;
                }
            });
            return choiceQuantities;
        }
        updateChoiceVariationPrice(sel) {
            const tile = sel.closest(".wof-product-choice-tile");
            if (!tile) return;
            const priceEl = tile.querySelector(".wof-choice__price");
            if (!priceEl) return;
            if (!priceEl.dataset.wofOriginalHtml) {
                priceEl.dataset.wofOriginalHtml = priceEl.innerHTML;
            }
            const opt = sel.selectedOptions?.[0];
            const price = opt?.dataset?.price ?? "";
            const regPrice = opt?.dataset?.regularPrice ?? "";
            const salePrice = opt?.dataset?.salePrice ?? "";
            const currency = window.WooOptionsProStorefront?.currencySymbol || "$";

            if (price && sel.value) {
                if (regPrice && salePrice && regPrice !== salePrice) {
                    priceEl.className = "wof-choice__price wof-choice__price--sale";
                    priceEl.innerHTML = `<del>${currency}${regPrice}</del> <ins>${currency}${salePrice}</ins>`;
                } else {
                    priceEl.className = "wof-choice__price";
                    priceEl.textContent = `${currency}${price}`;
                }
            } else {
                priceEl.innerHTML = priceEl.dataset.wofOriginalHtml;
            }
        }
        scheduleQuote(e = 320) { window.clearTimeout(this.quoteTimer), this.quoteTimer = window.setTimeout(() => { this.requestQuote(); }, e); }
        async requestQuote(e = !1, r = !1) {
            const a = this.readSelection();
            this.writeSelection(a);
            const productVariations = this.readProductVariations();
            const choiceQuantities = this.readChoiceQuantities();
            const i = JSON.stringify({ selection: a, productVariations, choiceQuantities });
            this.aborter?.abort(), this.aborter = new AbortController, this.setPending(!0);
            try {
                const n = await fetch(`${o}products/${this.productId()}/quote`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        token: this.payload.token,
                        variationId: this.variationId(),
                        quantity: this.quantity(),
                        selection: a,
                        productVariations,
                        choiceQuantities
                    }),
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: this.aborter.signal
                }),
                s = await n.json().catch(() => ({}));
            if (!n.ok) {
                if (!r && this.isTokenError(s) && await this.refreshConfigurationToken())
                    return await this.requestQuote(e, !0);
                throw new Error(this.restErrorMessage(s));
            }
            this.acceptToken(s.token), this.lastQuote = s, this.lastSelection = i, this.setPending(!1), this.renderQuote(s, e);
        }
        catch (r) {
            if (r instanceof DOMException && "AbortError" === r.name)
                return;
            this.lastQuote = null, this.showGlobalError(r instanceof Error ? r.message : t.couldNotQuote, e), this.setAddToCartEnabled(!1);
        }
        finally {
            this.setPending(!1);
        } }
        acceptToken(e) { if ("string" != typeof e || !e)
            return; this.payload.token = e; const t = this.root.querySelector('input[name="wooptions-pro_token"]'); t && (t.value = e); }
        isTokenError(e) { const t = Array.isArray(e?.data?.errors) ? e.data.errors : Array.isArray(e?.errors) ? e.errors : []; return "wooptions-pro_public_token_invalid" === e?.code || t.some(e => "public_token_invalid" === e?.code || "session_required" === e?.code); }
        restErrorMessage(e) { const o = Array.isArray(e?.data?.errors) ? e.data.errors : Array.isArray(e?.errors) ? e.errors : [], r = o.map(e => e?.code).filter(Boolean); return r.includes("rate_limited") ? "Price checking is temporarily busy. Wait a moment and try again." : r.includes("cross_set_duplicate_uuid") || "wooptions-pro_configuration_merge_failed" === e?.code ? "This product has conflicting option-set assignments. Review the assigned option sets and publish them again." : "string" == typeof e?.message && e.message ? e.message : t.couldNotQuote; }
        async refreshConfigurationToken() { const e = await fetch(`${o}products/${this.productId()}/configuration?variationId=${this.variationId()}&_wof=${Date.now()}`, { method: "GET", credentials: "same-origin", cache: "no-store", headers: { "Cache-Control": "no-cache" } }), t = await e.json().catch(() => ({})); if (!e.ok || !t?.token || !t?.configuration)
            return !1; const r = this.configuration?.revisionUuid ?? "", a = t.configuration.revisionUuid ?? ""; if (r && a && r !== a)
            throw new Error("Product options were updated. Refresh this page before continuing."); this.payload = { ...this.payload, ...t }, this.configuration = t.configuration, this.applyConfigurationSettings(), this.applyConfigurationStyle(); const i = this.root.querySelector('input[name="wooptions-pro_token"]'), n = this.root.querySelector('input[name="wooptions-pro_revision"]'); return i && (i.value = t.token), n && (n.value = a), !0; }
        applyConfigurationSettings() { const e = this.configuration?.settings ?? {}, t = this.root.querySelector("[data-wof-summary]"), o = this.root.querySelector("[data-wof-summary-rows]"), r = this.root.querySelector("[data-wof-save-panel]"), a = this.root.querySelector(".wof-configurator__grid"), i = this.root.querySelector("[data-wof-fields]"), breakdownBtn = this.root.querySelector("[data-wof-breakdown-trigger]"), saveModalTrigger = this.root.querySelector("[data-wof-save-modal-trigger]"), saveSection = this.root.querySelector("[data-wof-save-section]"), shareSection = this.root.querySelector("[data-wof-share-section]"), saveBtn = this.root.querySelector("[data-wof-save]"), shareBtn = this.root.querySelector("[data-wof-share]"), n = !1 !== e.showPriceBreakdown, s = !1 !== e.stickySummary, hasSave = Boolean(e.saveEnabled), hasShare = Boolean(e.shareEnabled), c = hasSave || hasShare; t?.classList.toggle("is-sticky", s), t && a && i && (s ? a.insertBefore(t, i) : a.append(t)), o && (o.hidden = !n), breakdownBtn && (breakdownBtn.hidden = !n), saveModalTrigger && (saveModalTrigger.hidden = !c), saveSection && (saveSection.hidden = !hasSave), shareSection && (shareSection.hidden = !hasShare), saveBtn && (saveBtn.hidden = !hasSave), shareBtn && (shareBtn.hidden = !hasShare), this.root.dataset.showPriceBreakdown = n ? "1" : "0", this.root.dataset.stickySummary = s ? "1" : "0", this.root.dataset.saveEnabled = hasSave ? "1" : "0"; const saveBtnText = this.root.querySelector("[data-wof-save-btn-text]"); if (saveBtnText) { saveBtnText.textContent = (hasSave && hasShare) ? "Save / Share" : (hasShare ? "Share link" : "Save"); } if (this.payload?.labels?.summaryTotal) { const totalSpan = t?.querySelector(".wof-summary__title") || t?.querySelector(".wof-summary__total span"); if (totalSpan) totalSpan.textContent = this.payload.labels.summaryTotal; const modalTotal = t?.querySelector(".wof-breakdown-modal__total-row span"); if (modalTotal) modalTotal.textContent = this.payload.labels.summaryTotal; } if (this.payload?.labels?.summaryNotice) { const noticeEl = t?.querySelector(".wof-summary__notice") || t?.querySelector("small"); if (noticeEl) noticeEl.textContent = this.payload.labels.summaryNotice; } }
        applyConfigurationStyle() { const e = this.configuration?.style ?? {}, t = e.tokens ?? {}; Object.entries(t).forEach(([e, t]) => { if ("string" != typeof t || !/^(?:#[0-9a-f]{6}|currentColor|Canvas|transparent)$/i.test(t))
            return; const o = e.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(); this.root.style.setProperty(`--wof-${o}`, t); }), this.root.dataset.wofPalette = String(e.palette ?? ""), this.root.style.colorScheme = "night-studio" === e.palette ? "dark" : "light"; const o = e.typography ?? {}, r = o.family ?? "inherit", a = { inherit: "inherit", "system-ui": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', Inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', Manrope: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', Poppins: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', Outfit: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', "Plus Jakarta Sans": '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', Roboto: '"Roboto", Arial, sans-serif' }; this.root.style.setProperty("--wof-font", a[r] ?? "inherit"), this.root.style.setProperty("--wof-label-weight", String(Math.max(400, Math.min(800, Number(o.labelWeight ?? 650))))), this.root.style.setProperty("--wof-body-weight", String(Math.max(300, Math.min(700, Number(o.bodyWeight ?? 450))))), this.root.style.setProperty("--wof-font-size", `${Math.max(16, Math.min(24, Number(o.desktopSize ?? 16)))}px`), this.root.style.setProperty("--wof-line-height", String(Math.max(1.2, Math.min(2, Number(o.lineHeight ?? 1.5))))), this.ensureTypographyFont(r); }
        ensureTypographyFont(e) { const t = { Inter: "Inter:wght@300;400;500;600;700;800", Manrope: "Manrope:wght@300;400;500;600;700;800", Poppins: "Poppins:wght@300;400;500;600;700;800", Outfit: "Outfit:wght@300;400;500;600;700;800", "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@300;400;500;600;700;800", Roboto: "Roboto:wght@300;400;500;600;700;800" }[e]; if (!t)
            return; const o = `wooptions-pro-font-${e.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; if (document.getElementById(o))
            return; const r = document.createElement("link"); r.id = o, r.rel = "stylesheet", r.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(t).replace(/%3A/g, ":").replace(/%40/g, "@").replace(/%3B/g, ";").replace(/%2B/g, "+")}&display=swap`, r.crossOrigin = "anonymous", document.head.append(r); }
        readSelection() { const e = {}; return (this.configuration?.fields ?? []).forEach(t => { (!t.disabled && this.acceptsValue(t)) && (e[t.uuid] = this.readField(t, this.root)); }), e; }
        readField(e, t) { const o = t.querySelector(`[data-wof-field="${r(e.uuid)}"]`); if (!o)
            return null; if ("repeater" === e.type) {
                if (!1 === e.repeatable) {
                    const s = {}; (e.children ?? []).forEach(child => { s[child.uuid] = this.readField(child, o); });
                    return [{ rowUuid: "static", values: s }];
                }
                return Array.from(o.querySelectorAll(":scope [data-wof-row], :scope [data-wof-repeater-rows] > [data-wof-row]")).map(rowEl => { const rowValues = {}; return (e.children ?? []).forEach(child => { rowValues[child.uuid] = this.readField(child, rowEl); }), { rowUuid: rowEl.dataset.wofRow, values: rowValues }; });
            } if ("checkbox" === e.type || "toggle" === e.type)
            return Boolean(o.querySelector('input[type="checkbox"]:checked')); if ("checkbox_group" === e.type || (e.multiple && "product" !== e.type)) {
                const checked = Array.from(o.querySelectorAll('input[type="checkbox"]:checked'));
                return checked.map(input => input.value);
            } if (["radio", "segmented", "color_swatch", "image_swatch"].includes(e.type) || ("product" === e.type && !e.multiple)) {
                return o.querySelector('input:checked')?.value ?? "";
            } if ("product" === e.type && e.multiple) {
                return Array.from(o.querySelectorAll("input:checked")).map(e => e.value);
            } if ("date_range" === e.type) {
            const start = o.querySelector('[data-wof-daterange-start]')?.value ?? o.querySelectorAll('input[type="date"]')[0]?.value ?? "";
            const end = o.querySelector('[data-wof-daterange-end]')?.value ?? o.querySelectorAll('input[type="date"]')[1]?.value ?? "";
            return { start, end };
        } if ("color_picker" === e.type) {
            return o.querySelector("[data-wof-color-input]")?.value ?? "";
        } if ("tel" === e.type) {
            const wrap = o.querySelector("[data-wof-phone-wrap]");
            if (wrap) {
                const select = wrap.querySelector("[data-wof-phone-select]");
                const input = wrap.querySelector(".wof-phone-number-input");
                const dial = select?.selectedOptions[0]?.dataset?.dial ?? "";
                const num = input?.value ?? "";
                return num ? (dial ? `${dial} ${num}` : num) : "";
            }
            return o.querySelector('input[type="tel"]')?.value ?? "";
        } return "file" === e.type ? Array.from(o.querySelectorAll("[data-wof-upload-ref]")).map(e => e.value).filter(Boolean) : o.querySelector('input:not([type="file"]), select, textarea')?.value ?? ""; }
        acceptsValue(e) { return !["heading", "paragraph", "help", "separator", "spacer", "formula", "calculated"].includes(e.type); }
        writeSelection(e) {
            const t = this.root.querySelector("[data-wof-selection-json]");
            t && (t.value = JSON.stringify(e));
            let varInput = this.root.querySelector('input[name="wooptions-pro_product_variations"]');
            if (!varInput) {
                varInput = document.createElement("input");
                varInput.type = "hidden";
                varInput.name = "wooptions-pro_product_variations";
                this.root.appendChild(varInput);
            }
            varInput.value = JSON.stringify(this.readProductVariations());

            let qtyInput = this.root.querySelector('input[name="wooptions-pro_choice_quantities"]');
            if (!qtyInput) {
                qtyInput = document.createElement("input");
                qtyInput.type = "hidden";
                qtyInput.name = "wooptions-pro_choice_quantities";
                this.root.appendChild(qtyInput);
            }
            qtyInput.value = JSON.stringify(this.readChoiceQuantities());
        }
        renderQuote(e, o = false) {
            if (e?.settings && (this.configuration.settings = { ...(this.configuration.settings ?? {}), ...e.settings }), e?.style && (this.configuration.style = e.style), e?.settings || e?.style)
                this.applyConfigurationSettings(), this.applyConfigurationStyle();

            this.applyStates(e.states);

            if (e.price) {
                const a = this.root.querySelector("[data-wof-total]");
                const bTotal = this.root.querySelector("[data-wof-breakdown-total]");
                // Show extendedTotal (unitPrice × product quantity) so the summary
                // reflects the full order amount when product quantity > 1.
                const displayPrice = e.price.extendedTotal ?? e.price.unitPrice;
                const formattedPrice = this.money(displayPrice.decimal, displayPrice.currency);
                if (a) a.textContent = formattedPrice;
                if (bTotal) bTotal.textContent = formattedPrice;

                const i = this.root.querySelector("[data-wof-summary-rows]");
                const modalItems = this.root.querySelector("[data-wof-breakdown-modal-items]");
                const breakdownCount = this.root.querySelector("[data-wof-breakdown-count]");
                const n = !1 !== this.configuration?.settings?.showPriceBreakdown;

                if (i) {
                    i.replaceChildren();
                }
                if (modalItems) {
                    modalItems.replaceChildren();
                }

                const contributions = (n && e.price?.contributions) ? e.price.contributions : [];
                if (contributions.length > 0) {
                    contributions.forEach(item => {
                        const formattedItemAmount = this.money(item.rounded.decimal, item.rounded.currency);
                        const isZero = Number(item.rounded.decimal) === 0;

                        if (modalItems) {
                            const mRow = document.createElement("div");
                            mRow.className = "wof-breakdown-item";
                            const mLabel = document.createElement("span");
                            mLabel.className = "wof-breakdown-item__label";
                            mLabel.textContent = item.label;
                            const mAmount = document.createElement("strong");
                            mAmount.className = "wof-breakdown-item__amount" + (isZero ? " is-zero" : "");
                            mAmount.textContent = isZero ? "Included" : formattedItemAmount;
                            mRow.append(mLabel, mAmount);
                            modalItems.append(mRow);
                        }

                        if (i && n) {
                            const row = document.createElement("div");
                            const label = document.createElement("span");
                            const amount = document.createElement("strong");
                            label.textContent = item.label;
                            amount.textContent = formattedItemAmount;
                            row.append(label, amount);
                            i.append(row);
                        }

                        const calcInputs = this.root.querySelectorAll(`[data-wof-calculated="${r(item.sourceUuid)}"]`);
                        calcInputs.forEach(calcInput => {
                            calcInput.value = formattedItemAmount;
                            calcInput.textContent = formattedItemAmount;
                        });
                    });
                } else if (modalItems) {
                    const emptyP = document.createElement("p");
                    emptyP.className = "wof-breakdown-modal__empty";
                    emptyP.textContent = "Base product price only. No additional options selected.";
                    modalItems.append(emptyP);
                }

                if (breakdownCount) {
                    breakdownCount.textContent = String(contributions.length);
                    breakdownCount.hidden = contributions.length === 0;
                }

                if (e.price?.formulas) {
                    const currency = e.price.unitPrice?.currency || window.WooOptionsProStorefront?.currency || 'USD';
                    Object.entries(e.price.formulas).forEach(([uuid, info]) => {
                        const outs = this.root.querySelectorAll(`[data-wof-calculated="${r(uuid)}"]`);
                        if (!outs.length) return;
                        const numVal = parseFloat(info.value) || 0;
                        let formatted = '';
                        const prefix = info.prefix ?? '';
                        const suffix = info.suffix ?? '';
                        const dec = typeof info.decimalPlaces === 'number' ? info.decimalPlaces : 2;
                        const numStr = numVal.toFixed(dec);
                        if (info.displayMode === 'text') {
                            formatted = `${prefix}${info.value}${suffix}`;
                        } else {
                            if (prefix) {
                                formatted = `${prefix}${numStr}${suffix}`;
                            } else {
                                const formattedMoney = this.money(numStr, info.currency || currency);
                                formatted = `${formattedMoney}${suffix}`;
                            }
                        }
                        outs.forEach(out => {
                            const fieldEl = out.closest('.wof-field');
                            if (info.hideWhenZero && Math.abs(numVal) < 1e-9) {
                                if (fieldEl) fieldEl.style.display = 'none';
                            } else {
                                if (fieldEl && !fieldEl.classList.contains('is-disabled')) {
                                    fieldEl.style.display = '';
                                }
                            }
                            out.value = formatted;
                            out.textContent = formatted;
                        });
                    });
                }
            }

            this.enforceMaxChoices();
            this.setAddToCartEnabled(true);

            if (!e.valid) {
                if (o || this.hasSubmitted) {
                    this.clearAllErrors();
                    this.renderErrors(e.errors, Boolean(o));
                    this.setStatus(t.couldNotQuote, "error");
                    if (o) {
                        this.showToast(this.getValidationToastMessage(e.errors), "error");
                    }
                } else {
                    const formatErrors = (e.errors || []).filter(err => {
                        const code = String(err.code || "");
                        return code.includes("invalid_email") || code.includes("invalid_url");
                    });
                    if (formatErrors.length > 0) {
                        this.renderErrors(formatErrors, false);
                    }
                    this.setStatus(this.payload?.labels?.summaryStatus || "Ready for your choices", "ready");
                }
                return;
            }

            // Valid quote
            this.hasSubmitted = false;
            this.clearAllErrors();
            this.setStatus(t.confirmed, "confirmed");

            if (o && this.form) {
                // Final-submit path: quote confirmed mid-submit — re-trigger form submission now.
                this.isSubmitting = true;
                const submitBtn = this.form.querySelector('button.single_add_to_cart_button, button[type="submit"][name="add-to-cart"], button[type="submit"]');
                try {
                    if (typeof this.form.requestSubmit === "function") {
                        submitBtn ? this.form.requestSubmit(submitBtn) : this.form.requestSubmit();
                    } else if (submitBtn) {
                        submitBtn.click();
                    } else {
                        this.form.submit();
                    }
                } finally {
                    setTimeout(() => { this.isSubmitting = false; }, 1000);
                }
            }
        }
        applyStates(e) {
            Object.entries(e ?? {}).forEach(([uuid, t]) => {
                const o = this.root.querySelector(`[data-wof-field="${r(uuid)}"]`);
                if (!o) return;
                const fieldDef = (this.configuration?.fields ?? []).find(f => f && f.uuid === uuid);
                const isExplicitlyDisabled = Boolean(fieldDef && fieldDef.disabled);
                const isVisible = isExplicitlyDisabled ? false : Boolean(t.visible);
                const isEnabled = isExplicitlyDisabled ? false : Boolean(t.enabled);

                o.hidden = !isVisible;
                o.style.display = isVisible ? "" : "none";
                o.classList.toggle("is-disabled", !isEnabled);
                const isFieldActive = isVisible && isEnabled;
                o.querySelectorAll("input, select, textarea").forEach(inp => {
                    inp.disabled = !isFieldActive || "true" === inp.dataset.wofFixedDisabled || isExplicitlyDisabled;
                    inp.required = false;
                    t.required && isFieldActive ? inp.setAttribute("aria-required", "true") : inp.removeAttribute("aria-required");
                });
            });
            this.enforceMaxChoices();
        }
        renderErrors(e, t) {
            const o = this.root.querySelector("[data-wof-errors]"), a = [];
            let i = null;
            if (e.forEach(err => {
                const fieldEl = err.fieldUuid ? this.root.querySelector(`[data-wof-field="${r(err.fieldUuid)}"]`) : (err.element || null);
                const msg = this.errorText(err.code, err.label, err.params);
                if (fieldEl) {
                    fieldEl.classList.add("is-invalid");
                    const errEl = fieldEl.querySelector("[data-wof-field-error]");
                    if (errEl) errEl.textContent = msg;
                    fieldEl.querySelector("input, select, textarea")?.setAttribute("aria-invalid", "true");
                    i ??= fieldEl;
                } else {
                    a.push(msg);
                }
            }), o && (o.hidden = 0 === a.length, o.textContent = a.join(" ")), t) {
                if (i) {
                    i.scrollIntoView({ behavior: "smooth", block: "center" });
                    const inputEl = i.querySelector("input:not([type='hidden']), select, textarea, [tabindex='0']");
                    inputEl?.focus();
                } else if (o) {
                    o.focus();
                }
            }
        }
        getValidationToastMessage(errors) {
            const errs = errors || [];
            const emailErr = errs.find(e => String(e.code || "").includes("invalid_email"));
            if (emailErr) {
                return `Please enter a valid email address for "${emailErr.label}".`;
            }
            const urlErr = errs.find(e => String(e.code || "").includes("invalid_url"));
            if (urlErr) {
                return `Please enter a valid website URL for "${urlErr.label}".`;
            }
            const phoneDigitsErr = errs.find(e => String(e.code || "").includes("invalid_phone_digits"));
            if (phoneDigitsErr) {
                const pMin = phoneDigitsErr.params?.min || phoneDigitsErr.min;
                const pMax = phoneDigitsErr.params?.max || phoneDigitsErr.max;
                const cName = phoneDigitsErr.params?.countryName || phoneDigitsErr.countryName || "";
                const suffix = cName ? ` (${cName})` : "";
                if (pMin && pMax && pMin === pMax) {
                    return `Please enter a valid ${pMin}-digit phone number for "${phoneDigitsErr.label}"${suffix}.`;
                }
                if (pMin && pMax) {
                    return `Please enter a valid ${pMin} to ${pMax}-digit phone number for "${phoneDigitsErr.label}"${suffix}.`;
                }
                return `Please enter a valid phone number for "${phoneDigitsErr.label}"${suffix}.`;
            }
            const phoneErr = errs.find(e => String(e.code || "").includes("invalid_phone"));
            if (phoneErr) {
                return `Please enter a valid phone number for "${phoneErr.label}".`;
            }

            const requiredErrors = errs.filter(e => {
                const code = String(e.code || "");
                return code.includes("required") || code.includes("incomplete");
            });

            if (requiredErrors.length > 0) {
                const names = [...new Set(requiredErrors.map(e => e.label).filter(Boolean))];
                if (names.length === 1) {
                    return `Please select or enter "${names[0]}" before adding to cart.`;
                }
                if (names.length > 1) {
                    return `Please complete the required options: ${names.join(", ")}.`;
                }
                return "Please complete all required options before adding to cart.";
            }

            return "Please review the highlighted options before adding to cart.";
        }
        showToast(message, type = "error", title = "") {
            let container = document.querySelector(".wof-toast-container");
            if (!container) {
                container = document.createElement("div");
                container.className = "wof-toast-container";
                document.body.appendChild(container);
            }

            container.querySelectorAll(".wof-toast").forEach(t => t.remove());

            const toast = document.createElement("div");
            toast.className = `wof-toast wof-toast--${type}`;
            toast.setAttribute("role", type === "error" ? "alert" : "status");
            toast.setAttribute("aria-live", "polite");

            let resolvedTitle = title;
            if (!resolvedTitle) {
                if (type === "error") {
                    const isFormat = message.includes("valid email") || message.includes("valid website URL") || message.includes("valid URL");
                    resolvedTitle = isFormat ? "Invalid Option" : "Required Options";
                }
                else if (type === "success") resolvedTitle = "Success";
                else if (type === "warning") resolvedTitle = "Attention";
                else resolvedTitle = "Notice";
            }

            let iconSvg = '';
            if (type === "success") {
                iconSvg = '<svg class="wof-toast__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            } else if (type === "warning") {
                iconSvg = '<svg class="wof-toast__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            } else if (type === "info") {
                iconSvg = '<svg class="wof-toast__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            } else {
                iconSvg = '<svg class="wof-toast__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            }

            const toastDuration = type === "error" ? 5000 : 4000;

            toast.innerHTML = `
                ${iconSvg}
                <div class="wof-toast__content">
                    ${resolvedTitle ? `<div class="wof-toast__title">${resolvedTitle}</div>` : ''}
                    <div class="wof-toast__message">${message}</div>
                </div>
                <button type="button" class="wof-toast__close" aria-label="Close notification">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div class="wof-toast__progress" aria-hidden="true">
                    <div class="wof-toast__progress-bar" style="animation-duration: ${toastDuration}ms;"></div>
                </div>
            `;

            let remaining = toastDuration;
            let startTime = Date.now();
            let timer = null;

            const dismiss = () => {
                if (toast.classList.contains("is-hiding")) return;
                toast.classList.add("is-hiding");
                toast.addEventListener("animationend", () => {
                    toast.remove();
                }, { once: true });
            };

            const startTimer = () => {
                startTime = Date.now();
                timer = setTimeout(dismiss, remaining);
            };

            const pauseTimer = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                remaining -= (Date.now() - startTime);
                if (remaining < 500) remaining = 500;
            };

            toast.querySelector(".wof-toast__close")?.addEventListener("click", dismiss);

            startTimer();

            toast.addEventListener("mouseenter", pauseTimer);
            toast.addEventListener("mouseleave", startTimer);

            container.appendChild(toast);
        }
        errorText(code, label = "", params = {}) {
            const name = label || "This option";
            const min = params?.minimum ?? "";
            const max = params?.maximum ?? "";

            if (code === "field_required" || code === "required") {
                return `${name} is required. Please select or enter a value.`;
            }
            if (code === "field_too_few_choices" || code === "too_few_choices") {
                return min ? `${name}: Please select at least ${min} item${Number(min) > 1 ? "s" : ""}.` : `${name}: Please select more items.`;
            }
            if (code === "field_too_many_choices" || code === "too_many_choices") {
                return max ? `${name} max allowed item ${max}.` : `${name} exceeds the allowed maximum.`;
            }
            if (code === "field_below_minimum" || code === "below_minimum") {
                return min ? `${name}: Minimum allowed value is ${min}.` : `${name} is below the allowed minimum.`;
            }
            if (code === "field_above_maximum" || code === "above_maximum") {
                return max ? `${name}: Maximum allowed value is ${max}.` : `${name} exceeds the allowed maximum.`;
            }
            if (code === "field_too_short" || code === "too_short" || code.includes("too_short") || code.includes("below_minimum_length")) {
                return min ? `${name}: Must be at least ${min} character${Number(min) > 1 ? "s" : ""}.` : `${name} is too short.`;
            }
            if (code === "field_too_long" || code === "too_long" || code.includes("too_long") || code.includes("above_maximum_length")) {
                return max ? `${name}: Cannot exceed ${max} character${Number(max) > 1 ? "s" : ""}.` : `${name} is too long.`;
            }
            if (code === "field_invalid_email" || code === "invalid_email") {
                return `Please enter a valid email address for ${name}.`;
            }
            if (code === "field_invalid_url" || code === "invalid_url") {
                return `Please enter a valid website URL for ${name}.`;
            }
            if (code === "field_invalid_phone_digits" || code === "invalid_phone_digits") {
                const pMin = params?.min;
                const pMax = params?.max;
                const cName = params?.countryName || "";
                const suffix = cName ? ` (${cName})` : "";
                if (pMin && pMax && pMin === pMax) {
                    return `Please enter a valid ${pMin}-digit phone number for ${name}${suffix}.`;
                }
                if (pMin && pMax) {
                    return `Please enter a valid ${pMin} to ${pMax}-digit phone number for ${name}${suffix}.`;
                }
                return `Please enter a valid phone number for ${name}${suffix}.`;
            }
            if (code === "field_invalid_phone" || code === "invalid_phone") {
                return `Please enter a valid phone number for ${name}.`;
            }
            if (code === "field_invalid_color" || code === "invalid_color") {
                return `Please select a valid color for ${name}.`;
            }
            if (code === "field_invalid_number" || code === "invalid_number") {
                return `Please enter a valid number for ${name}.`;
            }
            if (code === "field_invalid_date" || code === "invalid_date") {
                return `Please select a valid date for ${name}.`;
            }
            if (code === "field_invalid_time" || code === "invalid_time") {
                return `Please select a valid time for ${name}.`;
            }
            if (code === "field_invalid_datetime" || code === "invalid_datetime") {
                return `Please select a valid date and time for ${name}.`;
            }
            if (code.includes("incomplete_date_range")) {
                return `Please select both start and end dates for ${name}.`;
            }
            if (code.includes("invalid_date_range_order")) {
                return `${name}: End date must be on or after start date.`;
            }
            if (code.includes("same_day_not_allowed")) {
                return `${name}: Start and end date cannot be the same day.`;
            }
            if (code.includes("date_range_too_short")) {
                return min ? `${name}: Date range must be at least ${min} days.` : `${name}: Date range is too short.`;
            }
            if (code.includes("date_range_too_long")) {
                return max ? `${name}: Date range cannot exceed ${max} days.` : `${name}: Date range is too long.`;
            }
            if (code === "field_invalid_date_range" || code === "invalid_date_range") {
                return `${name}: End date must be on or after start date.`;
            }
            if (code === "field_too_many_files" || code === "too_many_files") {
                return max ? `${name}: You can upload up to ${max} file${Number(max) > 1 ? "s" : ""} maximum.` : `${name}: Too many files uploaded.`;
            }
            if (code.includes("required")) {
                return `${name} is required. Please select or enter a value.`;
            }
            if (code.includes("too_many") || code.includes("maximum")) {
                return max ? `${name} max allowed item ${max}.` : `${name} exceeds the allowed maximum.`;
            }
            if (code.includes("too_few") || code.includes("minimum")) {
                return min ? `${name}: Please select at least ${min} item${Number(min) > 1 ? "s" : ""}.` : `${name} is below the allowed minimum.`;
            }
            return `Please check ${name}.`;
        }
        clearAllErrors() { this.root.querySelectorAll(".is-invalid").forEach(e => this.clearFieldError(e)); const e = this.root.querySelector("[data-wof-errors]"); e && (e.hidden = !0, e.textContent = ""); }
        clearFieldError(e) { if (!e)
            return; e.classList.remove("is-invalid"); const t = e.querySelector("[data-wof-field-error]"); t && (t.textContent = ""), e.querySelector('[aria-invalid="true"]')?.removeAttribute("aria-invalid"); }
        setFieldError(fieldEl, msg) {
            if (!fieldEl) return;
            fieldEl.classList.add("is-invalid");
            const t = fieldEl.querySelector("[data-wof-field-error]");
            if (t) t.textContent = msg;
            fieldEl.querySelector("input, select, textarea")?.setAttribute("aria-invalid", "true");
        }
        getFieldDef(uuid) {
            if (!uuid || !this.configuration?.fields) return null;
            const search = (fields) => {
                for (const f of fields) {
                    if (f.uuid === uuid) return f;
                    if (f.children && Array.isArray(f.children)) {
                        const found = search(f.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            return search(this.configuration.fields);
        }
        isValidEmail(value) {
            if (!value || typeof value !== "string") return false;
            const val = value.trim();
            if (val.length < 5 || val.length > 254) return false;
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
            if (!emailRegex.test(val)) return false;
            const parts = val.split("@");
            if (parts.length !== 2) return false;
            const domain = parts[1];
            if (!domain || !domain.includes(".")) return false;
            const domainParts = domain.split(".");
            const tld = domainParts[domainParts.length - 1];
            if (!tld || tld.length < 2) return false;
            return true;
        }
        isValidUrl(value) {
            if (!value || typeof value !== "string") return false;
            const val = value.trim();
            if (val.length < 8) return false;
            if (!/^https?:\/\//i.test(val)) return false;
            try {
                const url = new URL(val);
                if (url.protocol !== "http:" && url.protocol !== "https:") return false;
                const hostname = url.hostname;
                if (!hostname) return false;
                if (hostname === "localhost") return true;
                if (!hostname.includes(".")) return false;
                const parts = hostname.split(".");
                const tld = parts[parts.length - 1];
                if (!tld || tld.length < 2) return false;
                return true;
            } catch {
                return false;
            }
        }
        validateSingleField(fieldEl) {
            if (!fieldEl) return null;
            if (fieldEl.hidden || fieldEl.classList.contains("is-disabled") || fieldEl.closest("[hidden]")) {
                this.clearFieldError(fieldEl);
                return null;
            }

            const uuid = fieldEl.dataset.wofField;
            const type = fieldEl.dataset.wofType || "";
            const fieldDef = this.getFieldDef(uuid);
            const label = fieldDef?.label || fieldEl.querySelector(".wof-field__label")?.textContent?.replace(/\*.*$/, "")?.trim() || "This option";
            const isRequired = Boolean(fieldDef?.required || fieldEl.querySelector(".wof-required") || fieldEl.querySelector('[aria-required="true"]'));

            const phoneWrap = fieldEl.querySelector("[data-wof-phone-wrap]");
            if (type === "tel" || phoneWrap) {
                const phoneInput = phoneWrap?.querySelector(".wof-phone-number-input") || fieldEl.querySelector('input[type="tel"]');
                const phoneVal = (phoneInput ? phoneInput.value : "").trim();

                if (isRequired && !phoneVal) {
                    return {
                        code: "field_required",
                        fieldUuid: uuid,
                        label,
                        element: fieldEl
                    };
                }

                if (phoneVal) {
                    // Check for invalid characters
                    if (!/^\+?[\d\s().\-]+$/.test(phoneVal)) {
                        return {
                            code: "field_invalid_phone",
                            fieldUuid: uuid,
                            label,
                            element: fieldEl
                        };
                    }

                    // Check country digit constraints
                    const select = phoneWrap?.querySelector("[data-wof-phone-select]");
                    const country = (select?.value || fieldDef?.defaultCountry || "US").toUpperCase();
                    const rule = this.getPhoneCountryRule(country);
                    const digits = phoneVal.replace(/\D/g, "");

                    if (digits.length < rule.min || digits.length > rule.max) {
                        return {
                            code: "field_invalid_phone_digits",
                            fieldUuid: uuid,
                            label,
                            element: fieldEl,
                            params: {
                                min: rule.min,
                                max: rule.max,
                                country,
                                countryName: rule.name,
                                actual: digits.length
                            }
                        };
                    }
                }

                return null;
            }

            const input = fieldEl.querySelector('input:not([type="hidden"]), select, textarea');
            const value = input ? input.value : "";
            const trimmed = (value ?? "").trim();

            if (isRequired && !trimmed) {
                return {
                    code: "field_required",
                    fieldUuid: uuid,
                    label,
                    element: fieldEl
                };
            }

            if (type === "email" || input?.type === "email") {
                if (trimmed && !this.isValidEmail(trimmed)) {
                    return {
                        code: "field_invalid_email",
                        fieldUuid: uuid,
                        label,
                        element: fieldEl
                    };
                }
            }

            if (type === "url" || input?.type === "url") {
                if (trimmed && !this.isValidUrl(trimmed)) {
                    return {
                        code: "field_invalid_url",
                        fieldUuid: uuid,
                        label,
                        element: fieldEl
                    };
                }
            }

            return null;
        }
        validateAllFields() {
            const errors = [];
            const fieldEls = this.root.querySelectorAll("[data-wof-field]");
            fieldEls.forEach(fieldEl => {
                const err = this.validateSingleField(fieldEl);
                if (err) {
                    errors.push(err);
                }
            });
            return errors;
        }
        showGlobalError(e, o = !1) { const r = this.root.querySelector("[data-wof-errors]"); r && (r.hidden = !1, r.textContent = e, o && r.focus()), this.setStatus(t.couldNotQuote, "error"); }
        setPending(e) { this.root.setAttribute("aria-busy", e ? "true" : "false"), this.root.classList.toggle("is-quoting", e), e && this.setStatus(t.checking, "pending"); }
        setStatus(e, t) { const o = this.root.querySelector("[data-wof-status]"); if (o) {
            o.dataset.state = t;
            const r = o.querySelector("span:last-child");
            r && (r.textContent = e);
        } }
        setAddToCartEnabled(e) { const t = this.form?.querySelector("button.single_add_to_cart_button"); t && (t.disabled = !e, t.setAttribute("aria-disabled", e ? "false" : "true")); }
        updateRangeOutputs() {
            this.root.querySelectorAll('input[type="range"]').forEach(slider => {
                const wrap = slider.closest("[data-wof-range-wrap]") || slider.parentElement;
                const output = wrap?.querySelector("[data-wof-range-output]");
                if (output) {
                    output.textContent = slider.value;
                    if ('value' in output) {
                        output.value = slider.value;
                    }
                }
                const min = parseFloat(slider.min) || 0;
                const max = parseFloat(slider.max) || 100;
                const val = parseFloat(slider.value) || 0;
                const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
                slider.style.setProperty('--range-progress', `${pct}%`);
            });
        }
        updateColorOutputs() {
            this.root.querySelectorAll("[data-wof-color-picker]").forEach(e => {
                this.syncCustomColorPicker(e);
            });
        }
        hexToHsv(hex) {
            let clean = String(hex || '').trim().replace(/^#/, '');
            if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
            if (!/^[0-9a-f]{6}$/i.test(clean)) clean = '5B4FF5';
            const num = parseInt(clean, 16);
            const r = (num >> 16) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
            let h = 0, s = max === 0 ? 0 : diff / max, v = max;
            if (diff !== 0) {
                if (max === r) h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
                else if (max === g) h = ((b - r) / diff + 2) / 6;
                else h = ((r - g) / diff + 4) / 6;
            }
            return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
        }
        hsvToHex(h, s, v) {
            const sNorm = Math.max(0, Math.min(100, s)) / 100;
            const vNorm = Math.max(0, Math.min(100, v)) / 100;
            const hNorm = ((h % 360) + 360) % 360;
            const f = (n, k = (n + hNorm / 60) % 6) => vNorm - vNorm * sNorm * Math.max(Math.min(k, 4 - k, 1), 0);
            const r = Math.round(f(5) * 255), g = Math.round(f(3) * 255), b = Math.round(f(1) * 255);
            return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
        }
        initCustomColorPickers() {
            this.root.querySelectorAll("[data-wof-color-picker]").forEach(elem => {
                this.syncCustomColorPicker(elem);
            });
        }
        syncCustomColorPicker(elem) {
            const input = elem.querySelector("[data-wof-color-input]");
            if (!input) return;
            let val = String(input.value || "#5B4FF5").trim();
            if (val && !val.startsWith("#")) val = "#" + val;
            if (/^#([0-9a-f]{3})$/i.test(val)) {
                const c = val.slice(1);
                val = '#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
            }
            const hex = /^#[0-9A-F]{6}$/i.test(val) ? val.toUpperCase() : "#5B4FF5";
            input.value = hex;
            const valElem = elem.querySelector("[data-wof-color-value]");
            if (valElem) valElem.textContent = hex;
            const swatch = elem.querySelector("[data-wof-color-swatch]");
            if (swatch) swatch.style.backgroundColor = hex;
        }
        closeAllCustomColorPickers(except = null) {
            document.querySelectorAll("[data-wof-color-picker].is-open").forEach(elem => {
                if (elem !== except) {
                    elem.classList.remove("is-open");
                    elem.closest(".wof-field")?.classList.remove("wof-field--color-picker-open");
                    elem.querySelector("[data-wof-color-trigger]")?.setAttribute("aria-expanded", "false");
                }
            });
        }
        toggleCustomColorPicker(trigger) {
            const container = trigger.closest("[data-wof-color-picker]");
            if (!container) return;
            const isCurrentlyOpen = container.classList.contains("is-open");
            if (isCurrentlyOpen) {
                this.closeAllCustomColorPickers();
                return;
            }
            this.closeAllCustomColorPickers(container);
            this.closeAllCustomSelects();
            this.closeAllCustomDateTimes();
            this.closeAllCustomDateRanges();
            container.classList.add("is-open");
            container.closest(".wof-field")?.classList.add("wof-field--color-picker-open");
            trigger.setAttribute("aria-expanded", "true");
            this.buildColorPickerDropdown(container);
        }
        buildColorPickerDropdown(container) {
            const dropdown = container.querySelector("[data-wof-color-dropdown]");
            if (!dropdown) return;
            const input = container.querySelector("[data-wof-color-input]");
            const initialHex = String(input?.value || "#5B4FF5").trim().toUpperCase();
            let currentHsv = this.hexToHsv(initialHex);

            const presets = [
                '#000000', '#FFFFFF', '#64748B', '#EF4444', '#F97316', '#F59E0B',
                '#10B981', '#06B6D4', '#3B82F6', '#5B4FF5', '#8B5CF6', '#EC4899'
            ];

            const presetHtml = presets.map(p =>
                `<button type="button" class="wof-color-picker__preset" data-wof-preset-color="${p}" style="background:${p}" aria-label="${p}"></button>`
            ).join('');

            dropdown.innerHTML = `
                <div class="wof-color-picker__plane" data-wof-color-plane style="background-color: hsl(${currentHsv.h}, 100%, 50%);">
                    <div class="wof-color-picker__plane-bg"></div>
                    <div class="wof-color-picker__plane-thumb" data-wof-color-plane-thumb style="left: ${currentHsv.s}%; top: ${100 - currentHsv.v}%;"></div>
                </div>
                <div class="wof-color-picker__hue-wrap">
                    <input type="range" min="0" max="360" value="${currentHsv.h}" class="wof-color-picker__hue-slider" data-wof-color-hue-slider aria-label="Hue">
                </div>
                <div class="wof-color-picker__presets">${presetHtml}</div>
                <div class="wof-color-picker__footer">
                    <span class="wof-color-picker__current-swatch" data-wof-color-current-swatch style="background-color: ${initialHex}"></span>
                    <input type="text" class="wof-color-picker__hex-input" data-wof-color-hex-input value="${initialHex}" maxlength="7" spellcheck="false" aria-label="Hex color">
                    <button type="button" class="wof-color-picker__done-btn" data-wof-color-done>Done</button>
                </div>
            `;

            const plane = dropdown.querySelector("[data-wof-color-plane]");
            const thumb = dropdown.querySelector("[data-wof-color-plane-thumb]");
            const hueSlider = dropdown.querySelector("[data-wof-color-hue-slider]");
            const hexInput = dropdown.querySelector("[data-wof-color-hex-input]");
            const currentSwatch = dropdown.querySelector("[data-wof-color-current-swatch]");
            const doneBtn = dropdown.querySelector("[data-wof-color-done]");

            const normalizeHex = (str) => {
                let clean = String(str || '').trim();
                if (clean.startsWith('#')) clean = clean.slice(1);
                if (/^[0-9a-f]{3}$/i.test(clean)) {
                    clean = clean.split('').map(c => c + c).join('');
                }
                if (/^[0-9a-f]{6}$/i.test(clean)) {
                    return '#' + clean.toUpperCase();
                }
                return null;
            };

            const applyColor = (hex, updateHexInput = true, updateControls = true) => {
                if (input) {
                    input.value = hex;
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                }
                this.syncCustomColorPicker(container);
                if (currentSwatch) currentSwatch.style.backgroundColor = hex;
                if (updateHexInput && hexInput && document.activeElement !== hexInput) {
                    hexInput.value = hex;
                }
                if (updateControls) {
                    currentHsv = this.hexToHsv(hex);
                    if (plane) plane.style.backgroundColor = `hsl(${currentHsv.h}, 100%, 50%)`;
                    if (thumb) {
                        thumb.style.left = `${currentHsv.s}%`;
                        thumb.style.top = `${100 - currentHsv.v}%`;
                    }
                    if (hueSlider) hueSlider.value = currentHsv.h;
                }
            };

            let isDraggingPlane = false;
            const updatePlaneFromCoords = (clientX, clientY) => {
                const rect = plane.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
                const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
                const s = Math.round((x / rect.width) * 100);
                const v = Math.round((1 - y / rect.height) * 100);
                currentHsv.s = s;
                currentHsv.v = v;
                if (thumb) {
                    thumb.style.left = `${s}%`;
                    thumb.style.top = `${100 - v}%`;
                }
                const newHex = this.hsvToHex(currentHsv.h, currentHsv.s, currentHsv.v);
                applyColor(newHex, true, false);
            };

            plane.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                isDraggingPlane = true;
                updatePlaneFromCoords(e.clientX, e.clientY);
                const onMouseMove = (ev) => {
                    if (isDraggingPlane) {
                        ev.preventDefault();
                        updatePlaneFromCoords(ev.clientX, ev.clientY);
                    }
                };
                const onMouseUp = () => {
                    isDraggingPlane = false;
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                };
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            });

            plane.addEventListener("touchstart", (e) => {
                if (!e.touches[0]) return;
                isDraggingPlane = true;
                updatePlaneFromCoords(e.touches[0].clientX, e.touches[0].clientY);
                const onTouchMove = (ev) => {
                    if (isDraggingPlane && ev.touches[0]) {
                        ev.preventDefault();
                        updatePlaneFromCoords(ev.touches[0].clientX, ev.touches[0].clientY);
                    }
                };
                const onTouchEnd = () => {
                    isDraggingPlane = false;
                    window.removeEventListener("touchmove", onTouchMove);
                    window.removeEventListener("touchend", onTouchEnd);
                };
                window.addEventListener("touchmove", onTouchMove, { passive: false });
                window.addEventListener("touchend", onTouchEnd);
            }, { passive: true });

            hueSlider.addEventListener("input", (e) => {
                e.stopPropagation();
                const h = Number(e.target.value);
                currentHsv.h = h;
                if (plane) plane.style.backgroundColor = `hsl(${h}, 100%, 50%)`;
                const newHex = this.hsvToHex(currentHsv.h, currentHsv.s, currentHsv.v);
                applyColor(newHex, true, false);
            });

            hueSlider.addEventListener("change", (e) => {
                e.stopPropagation();
            });

            dropdown.querySelectorAll("[data-wof-preset-color]").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const color = btn.dataset.wofPresetColor;
                    if (color) applyColor(color, true, true);
                });
            });

            hexInput.addEventListener("input", (e) => {
                e.stopPropagation();
                const raw = e.target.value.trim();
                const norm = normalizeHex(raw);
                if (norm && (raw.length === 6 || raw.length === 7)) {
                    applyColor(norm, false, true);
                }
            });

            hexInput.addEventListener("change", (e) => {
                e.stopPropagation();
            });

            hexInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    const norm = normalizeHex(hexInput.value);
                    if (norm) {
                        applyColor(norm, true, true);
                    } else if (input) {
                        hexInput.value = input.value;
                    }
                    this.closeAllCustomColorPickers();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeAllCustomColorPickers();
                }
            });

            hexInput.addEventListener("blur", (e) => {
                e.stopPropagation();
                const norm = normalizeHex(hexInput.value);
                if (norm) {
                    applyColor(norm, true, true);
                } else if (input) {
                    hexInput.value = input.value;
                }
            });

            doneBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const norm = normalizeHex(hexInput.value);
                if (norm) {
                    applyColor(norm, true, true);
                }
                this.closeAllCustomColorPickers();
            });
        }
        updateSelectPreview(e) { const t = e?.closest?.("[data-wof-select-wrap]"); if (!t) return; const o = t.querySelector("[data-wof-select-image]"), r = e.selectedOptions?.[0]?.dataset?.image ?? ""; o && (r ? (o.src = r, o.style.display = "") : o.style.display = "none"); }
        updateSelectPreviews() { this.root.querySelectorAll("[data-wof-select-wrap] select").forEach(e => this.updateSelectPreview(e)); }
        captureProductImageSnapshot() { if (this.productImageSnapshot) return; const e = this.root.closest(".product") ?? document, t = Array.from(e.querySelectorAll(".woocommerce-product-gallery__image.flex-active-slide img, .woocommerce-product-gallery__image:first-child img, .woocommerce-product-gallery .wp-post-image")).filter(e => !this.root.contains(e)), o = Array.from(new Set(t)); this.productImageSnapshot = o.map(e => ({ element: e, src: e.getAttribute("src"), srcset: e.getAttribute("srcset"), sizes: e.getAttribute("sizes"), dataSrc: e.getAttribute("data-src"), large: e.getAttribute("data-large_image"), parentHref: e.closest("a")?.getAttribute("href") ?? null })); }
        restoreProductImage() { if (!this.productImageSnapshot) return; this.productImageSnapshot.forEach(e => { const t = e.element, o = (r, a) => { null === a ? t.removeAttribute(r) : t.setAttribute(r, a); }; o("src", e.src), o("srcset", e.srcset), o("sizes", e.sizes), o("data-src", e.dataSrc), o("data-large_image", e.large); const r = t.closest("a"); r && (null === e.parentHref ? r.removeAttribute("href") : r.setAttribute("href", e.parentHref)); }); }
        updateProductImage(e = null) { const t = e?.closest?.('[data-wof-update-product-image="1"]') ?? this.root.querySelector('[data-wof-update-product-image="1"]'); if (!t) return; const o = t.querySelector('input:checked[data-wof-product-image-url]'), r = o?.dataset?.wofProductImageUrl ?? ""; if (!r) { o || this.restoreProductImage(); return; } this.captureProductImageSnapshot(), this.productImageSnapshot?.forEach(e => { const t = e.element; t.setAttribute("src", r), t.setAttribute("data-src", r), t.setAttribute("data-large_image", r), t.removeAttribute("srcset"), t.removeAttribute("sizes"); const o = t.closest("a"); o && o.setAttribute("href", r); }), this.root.dispatchEvent(new CustomEvent("wooptions-pro:product-image-updated", { detail: { url: r } })); }
        addRow(e) {
            const t = e.closest?.("[data-wof-repeater]") ?? (e.hasAttribute?.("data-wof-repeater") ? e : null),
                o = t?.querySelector("[data-wof-repeater-rows]"),
                r = o?.querySelectorAll(":scope > [data-wof-row]");
            if (!t || !o || !r?.length) return;
            const a = Number(t.dataset.max || 10);
            if (r.length >= a) return;
            const i = r[r.length - 1],
                n = i.cloneNode(true),
                s = i.dataset.wofRow ?? "",
                c = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
            n.dataset.wofRow = c;

            // Scope all names, IDs, label fors, and aria-describedby attributes to the new row
            n.querySelectorAll("[name], [id], [for], [aria-describedby]").forEach(el => {
                ["name", "id", "for", "aria-describedby"].forEach(attr => {
                    const val = el.getAttribute(attr);
                    if (!val) return;
                    if (s && val.includes(s)) {
                        el.setAttribute(attr, val.split(s).join(c));
                    } else if (attr === "name") {
                        el.setAttribute(attr, val.replace(/\[rows\]\[[^\]]+\]/, `[rows][${c}]`));
                    } else if (attr === "id" || attr === "for") {
                        el.setAttribute(attr, val + "-" + c);
                    }
                });
            });

            // Reset inputs
            n.querySelectorAll("input, textarea, select").forEach(inp => {
                if (inp instanceof HTMLInputElement) {
                    if (["checkbox", "radio"].includes(inp.type)) {
                        inp.checked = false;
                    } else if ("hidden" !== inp.type) {
                        inp.value = "";
                    } else if (inp.hasAttribute("data-wof-datetime-value") || inp.hasAttribute("data-wof-daterange-start") || inp.hasAttribute("data-wof-daterange-end")) {
                        inp.value = "";
                    }
                } else if (inp instanceof HTMLSelectElement) {
                    inp.selectedIndex = 0;
                    inp.value = inp.options[0]?.value ?? "";
                } else {
                    inp.value = "";
                }
                inp.removeAttribute("aria-invalid");
            });

            // Clear errors / validation
            n.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
            n.querySelectorAll("[data-wof-field-error]").forEach(el => { el.textContent = ""; });

            // Sync custom controls within cloned row
            n.querySelectorAll("[data-wof-custom-select]").forEach(cs => {
                cs.classList.remove("is-open");
                this.syncCustomSelect(cs);
            });
            n.querySelectorAll("[data-wof-color-picker]").forEach(cp => {
                cp.classList.remove("is-open");
                this.syncCustomColorPicker(cp);
            });
            n.querySelectorAll("[data-wof-custom-datetime]").forEach(dt => {
                dt.classList.remove("is-open");
                const valInput = dt.querySelector("[data-wof-datetime-value]");
                if (valInput) valInput.value = "";
                const displays = dt.querySelectorAll("[data-wof-datetime-display]");
                displays.forEach(d => { d.textContent = d.dataset.wofPlaceholder || ""; });
            });
            n.querySelectorAll("[data-wof-custom-daterange]").forEach(dr => {
                dr.classList.remove("is-open");
                const sDisplay = dr.querySelector('[data-wof-daterange-display="start"]');
                if (sDisplay) sDisplay.textContent = sDisplay.dataset.wofPlaceholder || "";
                const eDisplay = dr.querySelector('[data-wof-daterange-display="end"]');
                if (eDisplay) eDisplay.textContent = eDisplay.dataset.wofPlaceholder || "";
            });
            n.querySelectorAll("[data-wof-upload]").forEach(u => {
                u.classList.remove("has-files", "is-uploading", "is-complete");
                u.querySelectorAll("[data-wof-upload-list]").forEach(l => l.replaceChildren());
                u.querySelectorAll("[data-wof-upload-ref]:not([data-wof-upload-template])").forEach(ref => ref.remove());
            });
            n.querySelectorAll("[data-wof-phone-picker]").forEach(p => {
                p.classList.remove("is-open");
                p.querySelector("[data-wof-phone-trigger]")?.setAttribute("aria-expanded", "false");
                const search = p.querySelector("[data-wof-phone-search]");
                if (search) search.value = "";
                p.querySelectorAll("[data-wof-phone-option]").forEach(opt => {
                    opt.classList.remove("is-hidden");
                    opt.classList.remove("is-active");
                    opt.hidden = false;
                    opt.style.removeProperty("display");
                });
            });

            o.append(n);
            this.renumberRows(t);
            n.querySelector("input, select, textarea")?.focus();
            this.announceRows(t, "Row added.");
            this.syncQuantityStepper(t);
            this.scheduleQuote(50);
        }
        removeRow(e) { const t = e.closest("[data-wof-repeater]"), o = e.closest("[data-wof-row]"), r = t?.querySelectorAll("[data-wof-row]"); if (!t || !o || !r || r.length <= Number(t.dataset.min || 0))
            return; const a = o.previousElementSibling?.querySelector("input, select, textarea") ?? t.querySelector("[data-wof-add-row]"); o.remove(), this.renumberRows(t), a?.focus(), this.announceRows(t, "Row removed."), this.syncQuantityStepper(t), this.scheduleQuote(50); }
        moveRow(e) { const t = e.closest("[data-wof-repeater]"), o = e.closest("[data-wof-row]"), r = e.dataset.wofMoveRow; t && o && ("up" === r && o.previousElementSibling && o.parentElement?.insertBefore(o, o.previousElementSibling), "down" === r && o.nextElementSibling && o.parentElement?.insertBefore(o.nextElementSibling, o), this.renumberRows(t), e.focus(), this.announceRows(t, "Row moved."), this.scheduleQuote(50)); }
        renumberRows(e) { const template = e.dataset.wofRepeatLabel || "Item {n}"; e.querySelectorAll("[data-wof-row]").forEach((e, t) => { const o = e.querySelector("[data-wof-row-title]") || e.querySelector("legend"); o && (o.textContent = template.replace("{n}", String(t + 1)).replace("{index}", String(t + 1))); }); }
        syncQuantityStepper(e) { const qtyInput = e.closest("[data-wof-field]")?.querySelector("[data-wof-repeater-qty-input]"); qtyInput && (qtyInput.value = String(e.querySelectorAll("[data-wof-row]").length)); }
        announceRows(e, t) { const o = e.querySelector("[data-wof-repeater-live]"); o && (o.textContent = t); }
        formatBytes(e) { const t = Number(e); return Number.isFinite(t) && t > 0 ? t >= 1048576 ? `${(t / 1048576).toFixed(t >= 10485760 ? 1 : 2)} MB` : t >= 1024 ? `${(t / 1024).toFixed(1)} KB` : `${t} B` : "0 B"; }
        uploadFileIconSvg(e, t) { const o = (String(t ?? "").split(".").pop() ?? "").toLowerCase(), r = String(e ?? "").toLowerCase(); return "pdf" === o || r.includes("pdf") ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M6.5 2.75h7l4 4v14.5h-11zM13.5 2.75v4h4M8.7 12.1h6.6M8.7 15.2h6.6M8.7 18.3h4.2" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "csv" === o || r.includes("spreadsheet") || r.includes("excel") || r.includes("csv") ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 4.5h16v15H4zM4 9.5h16M4 14.5h16M9.4 4.5v15M14.7 4.5v15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "txt" === o || r.startsWith("text/") ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M8.7 11h6.6M8.7 14.3h6.6M8.7 17.6h4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : r.startsWith("audio/") ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M9.5 18.2a2.7 2.7 0 1 1-2.7-2.7c1.05 0 1.9.28 2.7.82V6.2l8-1.7v11.8a2.7 2.7 0 1 1-2.7-2.7c1.05 0 1.9.28 2.7.82V8.1l-8 1.7z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>' : r.startsWith("video/") ? '<svg viewBox="0 0 24 24" focusable="false"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>' : r.includes("zip") || r.includes("archive") || ["zip", "rar", "7z"].includes(o) ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M10.5 5.5h2M10.5 8h2M10.5 10.5h2M10.2 14h2.6v3.4h-2.6z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
        releaseUploadPreview(e) { const t = e?.dataset?.wofPreviewUrl ?? ""; t && window.URL?.revokeObjectURL && (window.URL.revokeObjectURL(t), delete e.dataset.wofPreviewUrl); }
        renderUploadItemIcon(e, t, o = "", r = !1) { const a = e.querySelector(".wof-upload-item__icon"); if (!a)
            return; this.releaseUploadPreview(e); const i = String(o || t?.type || "").toLowerCase(), n = String(t?.name || "").toLowerCase(), s = (n.split(".").pop() ?? "").toLowerCase(); a.className = "wof-upload-item__icon", a.replaceChildren(); if (r && i.startsWith("image/") && t instanceof Blob && window.URL?.createObjectURL) {
            const o = window.URL.createObjectURL(t), r = document.createElement("img");
            r.src = o, r.alt = "", r.loading = "eager", r.decoding = "async", r.dataset.wofObjectUrl = "true", e.dataset.wofPreviewUrl = o, a.classList.add("is-image"), a.append(r);
            return;
        } const c = i.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(s); a.classList.add(c ? "is-image-file" : "pdf" === s || i.includes("pdf") ? "is-pdf" : "csv" === s || i.includes("csv") || i.includes("spreadsheet") ? "is-sheet" : "txt" === s || i.startsWith("text/") ? "is-text" : i.startsWith("audio/") ? "is-audio" : i.startsWith("video/") ? "is-video" : i.includes("zip") || i.includes("archive") || ["zip", "rar", "7z"].includes(s) ? "is-archive" : "is-file"), a.innerHTML = c ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 5.5h15v13h-15zM7.5 15l3.2-3.5 2.4 2.3 1.9-2 2.5 3.2M9 9.2h.01" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>' : this.uploadFileIconSvg(i, n); }
        createUploadItem(e, t) { const o = document.createElement("div"); o.className = "wof-upload-item is-uploading", o.innerHTML = '<button type="button" class="wof-upload-item__remove" data-wof-upload-remove aria-label="Remove file"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button><span class="wof-upload-item__icon" aria-hidden="true"></span><span class="wof-upload-item__copy"><strong></strong><span class="wof-upload-item__progress" aria-hidden="true"><i></i></span><small></small></span><span class="wof-upload-item__size"></span>'; const r = o.querySelector("strong"), a = o.querySelector(".wof-upload-item__size"), i = o.querySelector(".wof-upload-item__copy small"); return r && (r.textContent = e.name), a && (a.textContent = this.formatBytes(e.size)), i && (i.textContent = t), this.renderUploadItemIcon(o, e, e.type, !1), o; }
        setUploadItemError(e, t, o = "") { e.classList.remove("is-uploading", "is-complete"), e.classList.add("is-error"); const r = e.querySelector(".wof-upload-item__copy small"), a = e.querySelector(".wof-upload-item__progress"); r && (r.textContent = t), a && (a.hidden = !0), o && (e.dataset.errorDetail = o); }
        setUploadItemComplete(e, t, o) { e.classList.remove("is-uploading", "is-error"), e.classList.add("is-complete"), e.dataset.wofUploadId = t.opaqueId; const r = e.querySelector(".wof-upload-item__copy small"), a = e.querySelector(".wof-upload-item__size"), i = e.querySelector(".wof-upload-item__progress i"); r && (r.textContent = "Upload complete"), a && (a.textContent = this.formatBytes(t.bytes)), i && (i.style.width = "100%"), this.renderUploadItemIcon(e, o, t.mime, !0); }
        removeUpload(e) { const t = e.closest("[data-wof-upload]"), o = e.closest(".wof-upload-item"); if (!t || !o)
            return; const a = o.dataset.wofUploadId ?? ""; a && t.querySelector(`[data-wof-upload-ref][data-wof-upload-id="${r(a)}"]`)?.remove(), this.releaseUploadPreview(o), o.remove(), t.classList.toggle("has-files", Boolean(t.querySelector(".wof-upload-item"))), this.scheduleQuote(50); }
        async upload(e) { const o = e.closest("[data-wof-field]"), r = e.closest("[data-wof-upload]"), a = r?.querySelector("[data-wof-upload-list]"), i = r?.querySelector("[data-wof-upload-template]"), n = Array.from(e.files ?? []); if (!(n.length && o && r && a && i))
            return; const s = Math.max(1, Number(r.dataset.maxFiles ?? 1)), c = Math.max(1, Number(r.dataset.maxFileMb ?? 5)), d = c * 1048576; if (n.length > s)
            return this.showGlobalError(`Choose no more than ${s} file${1 === s ? "" : "s"}.`, !0), void (e.value = ""); r.querySelectorAll("[data-wof-upload-ref]:not([data-wof-upload-template])").forEach(e => e.remove()), a.querySelectorAll(".wof-upload-item").forEach(e => this.releaseUploadPreview(e)), a.replaceChildren(), r.classList.add("is-uploading"), r.classList.remove("is-complete"), this.setStatus(t.uploading, "pending"); let u = 0; for (const h of n) {
            const n = this.createUploadItem(h, "Uploading…");
            a.append(n);
            if (h.size > d) {
                this.setUploadItemError(n, "File is too large", `Max File Size: ${c}MB`);
                const e = n.querySelector(".wof-upload-item__copy small");
                e && (e.innerHTML = "", e.append(document.createTextNode("File is too large"), document.createElement("br")));
                const t = document.createElement("span");
                t.className = "wof-upload-item__detail", t.textContent = `Max File Size: ${c}MB`, e?.append(t);
                continue;
            }
            try {
                const t = await this.uploadFile(h, o.dataset.wofField ?? "", e.closest("[data-wof-row]")?.dataset.wofRow ?? "");
                const r = i.cloneNode(!0);
                r.removeAttribute("data-wof-upload-template"), r.removeAttribute("hidden"), r.value = t.opaqueId, r.dataset.wofUploadId = t.opaqueId, i.insertAdjacentElement("afterend", r), this.setUploadItemComplete(n, t, h), u++;
            }
            catch (e) {
                this.setUploadItemError(n, e instanceof Error ? e.message : "The file was not accepted.");
            }
        } r.classList.remove("is-uploading"), r.classList.toggle("is-complete", u > 0), r.classList.toggle("has-files", a.children.length > 0), e.value = "", this.scheduleQuote(50); }
        uploadErrorMessage(e, t = "The file was not accepted.") { const o = Array.isArray(e?.data?.errors) ? e.data.errors : Array.isArray(e?.errors) ? e.errors : [], r = o.map(e => e?.code).filter(Boolean); return r.includes("session_required") ? "Your upload session could not be started. Refresh the page and try again." : r.includes("invalid_upload_field") ? "This upload field is no longer available. Refresh the product page." : r.includes("upload_size") ? "The file is larger than the allowed upload limit." : r.includes("upload_extension") ? "This file type is not allowed for this option." : r.includes("upload_mime") ? "The file contents do not match its file extension." : r.includes("upload_dimensions") ? "The image dimensions are too large or the image is invalid." : r.includes("upload_rejected") ? "The file did not pass the security scan." : r.includes("upload_revision_changed") ? "The product options were updated. Refresh the page before uploading." : r.includes("upload_intent_expired") ? "The upload took too long. Choose the file again." : r.includes("upload_error") || r.includes("upload_missing") ? "The browser could not send this file. Choose it again." : "string" == typeof e?.message && e.message && "The request contains invalid configuration data." !== e.message ? e.message : t; }
        async uploadFile(e, t, r, a = !1) { const i = await fetch(`${o}uploads/intents`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ productId: this.productId(), variationId: this.variationId(), fieldUuid: t, rowUuid: r, token: this.payload.token }) }), n = await i.json().catch(() => ({})); if (!i.ok || !n.opaqueId) {
            if (!a && this.isTokenError(n) && await this.refreshConfigurationToken())
                return this.uploadFile(e, t, r, !0);
            throw new Error(this.uploadErrorMessage(n, "The upload could not start."));
        } const s = async (t) => { const r = new FormData; r.append("file", e), r.append("token", this.payload.token); const a = await fetch(`${o}uploads/${n.opaqueId}/complete`, { method: "POST", body: r, credentials: "same-origin", cache: "no-store" }), i = await a.json().catch(() => ({})); if (!a.ok || !i.opaqueId) {
            if (!t && this.isTokenError(i) && await this.refreshConfigurationToken())
                return s(!0);
            throw new Error(this.uploadErrorMessage(i));
        } return { opaqueId: i.opaqueId, name: i.name ?? e.name, bytes: Number(i.bytes ?? e.size), mime: i.mime ?? e.type }; }; return s(!1); }
        async saveConfiguration(e = !1) { if (!this.configuration?.settings?.saveEnabled && !this.configuration?.settings?.shareEnabled)
            return; if (!this.lastQuote?.valid && (await this.requestQuote(!0), !this.lastQuote?.valid))
            return; const t = this.root.querySelector("[data-wof-save-status]"), r = this.root.querySelector("[data-wof-save-name]")?.value ?? "My configuration"; t && (t.textContent = "Saving…"); try {
            const a = await fetch(`${o}saved-configurations`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ productId: this.productId(), variationId: this.variationId(), name: r, selection: this.readSelection(), token: this.payload.token }) }), i = await a.json().catch(() => ({}));
            if (!a.ok || !i.uuid) {
                if (!e && this.isTokenError(i) && await this.refreshConfigurationToken())
                    return this.saveConfiguration(!0);
                throw new Error(this.restErrorMessage(i));
            }
            this.savedUuid = i.uuid, t && (t.textContent = "Configuration saved."), this.root.querySelector("[data-wof-share]")?.removeAttribute("hidden");
        }
        catch (e) {
            t && (t.textContent = e instanceof Error ? e.message : "Save failed.");
        } }
        async shareConfiguration(e = !1) { if (this.savedUuid || await this.saveConfiguration(), !this.savedUuid)
            return; const t = this.root.querySelector("[data-wof-save-status]"); t && (t.textContent = "Creating share link…"); try {
            const r = await fetch(`${o}saved-configurations/${this.savedUuid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ action: "share" }) }), a = await r.json().catch(() => ({}));
            if (!r.ok || !a.token) {
                if (!e && this.isTokenError(a) && await this.refreshConfigurationToken())
                    return this.shareConfiguration(!0);
                const o = Array.isArray(a?.data?.errors) ? a.data.errors : Array.isArray(a?.errors) ? a.errors : [], r = o.map(e => e?.code).filter(Boolean);
                throw new Error(r.includes("share_disabled") ? "Share links are disabled for this option set." : r.includes("session_required") ? "Your saved-configuration session expired. Save it again and retry." : "string" == typeof a?.message && a.message && "The request contains invalid configuration data." !== a.message ? a.message : "Could not create a share link.");
            }
            const i = new URL(window.location.href);
            i.searchParams.set("wof_share", a.token);
            const n = this.root.querySelector("[data-wof-share-link]"), s = n?.querySelector("input");
            n && s && (n.hidden = !1, s.value = i.toString(), s.focus(), s.select()), t && (t.textContent = "Share link created.");
        }
        catch (e) {
            t && (t.textContent = e instanceof Error ? e.message : "Share failed.");
        } }
        async copyShareLink() { const e = this.root.querySelector("[data-wof-share-link] input"); if (e?.value)
            try {
                await navigator.clipboard.writeText(e.value);
                const t = this.root.querySelector("[data-wof-save-status]");
                t && (t.textContent = "Share link copied to clipboard.");
                const btnSpan = this.root.querySelector("[data-wof-copy-share] span");
                if (btnSpan) {
                    const orig = btnSpan.textContent;
                    btnSpan.textContent = "Copied!";
                    setTimeout(() => { btnSpan.textContent = orig; }, 2000);
                }
            }
            catch {
                e.focus(), e.select();
            } }
        loadSharedConfiguration() { const e = new URL(window.location.href).searchParams.get("wof_share"); e && fetch(`${o}shared-configurations/${encodeURIComponent(e)}/load`, { method: "POST", credentials: "same-origin" }).then(async (e) => { const t = await e.json(); if (!e.ok || !t.configuration || t.configuration.productId !== this.productId())
            throw new Error(t.message ?? "This shared configuration is unavailable for this product."); this.applySelection(t.configuration.selection), this.scheduleQuote(50); const o = this.root.querySelector("[data-wof-save-status]"); o && (o.textContent = "Shared configuration loaded."); }).catch(e => this.showGlobalError(e instanceof Error ? e.message : "Shared configuration could not load.")); }
        applySelection(e) { this.configuration.fields.forEach(t => { const o = e[t.uuid], a = this.root.querySelector(`[data-wof-field="${r(t.uuid)}"]`); if (!a || void 0 === o || "repeater" === t.type)
            return; if ("checkbox" === t.type || "toggle" === t.type) {
            const e = a.querySelector('input[type="checkbox"]');
            return void (e && (e.checked = Boolean(o)));
        } if (t.choices) {
            const e = Array.isArray(o) ? o.map(String) : [String(o)];
            a.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(t => { t.checked = e.includes(t.value); });
            const t = a.querySelector("select");
            if (t) {
                t.value = e[0] ?? "";
                const cs = a.querySelector("[data-wof-custom-select]");
                if (cs) this.syncCustomSelect(cs);
            }
            return;
        } if ("tel" === t.type) {
            const wrap = a.querySelector("[data-wof-phone-wrap]");
            if (wrap && "string" == typeof o) {
                const parts = o.trim().split(" ");
                if (parts.length > 1 && parts[0].startsWith("+")) {
                    const dial = parts[0];
                    const num = parts.slice(1).join(" ");
                    const select = wrap.querySelector("[data-wof-phone-select]");
                    if (select) {
                        const opt = Array.from(select.options).find(o => o.dataset.dial === dial);
                        if (opt) { select.value = opt.value; this.updatePhoneCountry(select); }
                    }
                    const input = wrap.querySelector(".wof-phone-number-input");
                    if (input) input.value = num;
                    return;
                }
            }
        } const i = a.querySelector('input:not([type="file"]), textarea, select'); if (i && "object" != typeof o) { i.value = String(o ?? ""); const cs = a.querySelector("[data-wof-custom-select]"); if (cs) this.syncCustomSelect(cs); } }), this.updateColorOutputs(), this.updateProductImage(), this.enforceMaxChoices(); }
        money(e, t) {
            const o = Number(e);
            if (Number.isFinite(o)) {
                const symbol = window.WooOptionsProStorefront?.currencySymbol || '$';
                const pos = window.WooOptionsProStorefront?.currencyPosition || 'left_space';
                const dec = (String(e).split('.')[1] || '00').length;
                const formattedNum = o.toFixed(Math.min(6, Math.max(2, dec)));
                if (pos === 'right') return `${formattedNum}${symbol}`;
                if (pos === 'right_space') return `${formattedNum} ${symbol}`;
                if (pos === 'left') return `${symbol}${formattedNum}`;
                return `${symbol} ${formattedNum}`;
            }
            return `${e}`;
        }
        productId() { return Number(this.root.dataset.productId ?? 0); }
        variationId() { return Number(this.form?.querySelector("input.variation_id")?.value ?? 0); }
        quantity() { return Math.max(1, Number(this.form?.querySelector("input.qty")?.value ?? 1)); }
    }
    function i() { document.querySelectorAll("[data-wof-root]").forEach(e => { if (!e.dataset.wofReady) {
        e.dataset.wofReady = "true";
        try {
            new a(e);
        }
        catch (e) {
            window.console.error("WooOptionsPro could not initialize.", e);
        }
    } }); }
    "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i();
})();
