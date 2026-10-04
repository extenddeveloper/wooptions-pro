# WooOptions Pro — Product Options for WooCommerce

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/extenddeveloper/wooptions-pro)
[![WordPress](https://img.shields.io/badge/WordPress-6.9%2B-21759b.svg)](https://wordpress.org/)
[![WooCommerce](https://img.shields.io/badge/WooCommerce-9.0%2B-96588a.svg)](https://woocommerce.com/)
[![PHP](https://img.shields.io/badge/PHP-8.1%2B-777bb4.svg)](https://php.net/)
[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2%2B-green.svg)](https://www.gnu.org/licenses/gpl-2.0.html)

**WooOptions Pro** is a modern, accessible, and rock-solid product customizer and extra product options plugin for WooCommerce. It empowers store owners and agencies to create rich, visually stunning, multi-tiered product configurators without writing a single line of theme code.

Built with a WordPress-native React admin experience (**Precision Workshop**) and a lightning-fast, accessible storefront runtime, WooOptions Pro ensures every selection, rule, formula, upload, and price calculation is rigorously re-validated on the server by PHP.

---

## ✨ Key Features

### 🛠️ Precision Workshop (Visual Builder)
- **Fluid Three-Column Workspace**: Searchable field element palette, interactive live storefront preview canvas, and contextual inspector sidebar.
- **Multi-Device Responsive Preview**: Test your product configurator across Desktop, Tablet, and Mobile viewport modes with a single click.
- **Undo / Redo & Autosave**: Full state history with point-in-time undo/redo actions and non-blocking background draft saving.
- **Inline Title & Settings Editor**: Clean inline title editing, revision management, and quick assignment shortcuts directly from the builder topbar.

### 🧩 34+ Rich Field & Content Elements
- **Selection Choices**: Radio groups, Checkbox groups, Dropdowns, Segmented buttons, Button choices, Image swatches, Color swatches, and Product choices.
- **Typography & Font Choices**: Live Google Fonts and system font selectors for engraving, embroidery, and monogramming.
- **Text & Numeric Inputs**: Single-line text, Multiline textareas, Number inputs with step/min/max limits, and Hidden fields.
- **Media & File Uploads**: Drag-and-drop customer file uploads with strict MIME detection, maximum file size enforcement, and image dimension bounds.
- **Dates & Scheduling**: Date pickers, Time selectors, and Date Range pickers with blackout dates and lead-time constraints.
- **Flexible Pricing Inputs**: Customer-defined pricing (Donations / Name Your Price) with preset buttons and custom amount inputs.
- **Structural & Informational**: Repeatable sections (Repeaters) with stable keys, Sections, Fieldsets, Headings, Rich HTML blocks, Dividers, and Help tooltips.

### 💰 Advanced Multi-Model Pricing Engine
- **Flat Add-on Pricing**: Add fixed surcharges to choices or inputs.
- **Percentage-Based Adjustments**: Increase or decrease base product prices by percentage marks.
- **Per-Character & Per-Unit Pricing**: Charge customers per character (ideal for engraving) or per measurement unit.
- **Tiered & Quantity-Based Pricing**: Adjust add-on costs according to product purchase quantity.
- **Formula Pricing (Safe Math AST)**: Craft dynamic custom pricing expressions (e.g., `width * drop * fabric_rate + trim_fee`). Formulas are parsed into an Abstract Syntax Tree (AST) and executed safely without `eval()`.
- **Server-Side Revalidation**: Client-side prices are treated purely as visual previews. The final cart price is always computed securely by PHP.

### ⚡ Dynamic Conditional Logic
- **Real-Time Visibility & Requirements**: Dynamically show, hide, enable, disable, or require fields based on customer selections.
- **Multi-Condition Groups**: Create complex nested rules using `AND` / `OR` logic across multiple fields.
- **Conditional Pricing Multipliers**: Modify pricing formulas or choice fees based on active conditions.

### 📦 13 Pre-Designed Starter Templates
Quickly launch common product customizers with one click:
1. **Design-your-own Pizza**: Crust styles, stuffed crust options, sauces, cheeses, meat & veggie toppings with per-choice quantities.
2. **Gourmet Burger Builder**: Artisan buns, patties, cooking temperatures, gourmet sauces, toppings, and sides.
3. **Personalized Apparel**: Color swatches, garment sizes, embroidery text, typography fonts, and artwork upload.
4. **Luxury Flower Bouquet**: Stem count sizing tiers, rose palettes, bespoke wrapping papers, ribbons, card notes, and delivery calendar.
5. **Custom Printed Mug**: Ceramic/enamel styles, interior glaze swatches, photo upload, custom engraved text, and gift packaging.
6. **Custom Pet Harness**: Breed sizing, reflective colorways, engraved ID nameplates, phone numbers, and matching leash bundles.
7. **Gift Box Builder**: Custom hampers with artisan treats, beverages, candles, cards, and satin ribbons.
8. **Personalized Engraving**: Text line counts, live font previews, symbol choices, and velvet gift pouch add-ons.
9. **Made-to-Measure Curtains**: Width & drop millimeter calculations, fabric selections, linings, and heading styles.
10. **Custom Computer Builder**: CPU, GPU, RAM, SSD, cooling, power supply, and compatibility rules.
11. **Donation / Contribution Widget**: Preset contribution tiers, custom amounts, honoree dedications, and notes.
12. **Equipment & Vehicle Rental**: Date range calendar, pickup/return times, delivery services, and damage waiver protection.
13. **Team Athletic Roster**: Repeatable player lists with player names, uniform sizes, and jersey numbers.

### 🎯 Deterministic Targeting & Assignments
- Assign option sets to:
  - **All Products** (Storewide global options)
  - **Specific Products** (Include or Exclude)
  - **Product Categories** (Include or Exclude)
  - **Product Tags** (Include or Exclude)
  - **Product Types** (Simple, Variable, External)
- Deterministic priority resolution guarantees conflict-free option set application.

### 🎨 Style Studio & Accessible Theming
- **7 Curated Design Palettes**: Theme Native, Iris Studio, Ocean Commerce, Ember Craft, Forest Atelier, Mono Luxe, and Night Studio.
- **Color Customization**: Fine-tune background, surface, primary accent, border, text, and validation colors.
- **WCAG Accessibility**: Real-time color contrast analysis ensures your configurator meets accessibility standards.
- **CSS Variable Architecture**: Seamlessly inherits theme typography and container widths without layout shifts.

### 🔒 Enterprise-Grade Security
- **Tamper-Proof Commerce**: Browser-submitted prices are never trusted. All totals, taxes, and option surcharges are calculated in PHP during `woocommerce_add_to_cart_validation` and cart item calculations.
- **Immutable Revisions**: Published option sets are saved as permanent, immutable revisions. Subsequent edits create working drafts, ensuring existing orders and active cart sessions are never corrupted.
- **Protected File Uploads**: Uploaded assets are verified for MIME types, file sizes, and image dimensions. Files are stored in a private directory with random opaque tokens, accessible only by store administrators and the customer who placed the order.
- **Zero `eval()`**: All formula math is parsed by a strict, bounded grammar evaluator.

---

## 📋 Requirements

- **WordPress**: 6.9 or newer
- **PHP**: 8.1 or newer (PHP 8.2 & 8.3 fully supported)
- **WooCommerce**: 9.0 or newer
- **HTTPS**: Required for secure file uploads and authenticated REST endpoints

---

## 🚀 Quick Start Guide

1. Download the latest release `.zip` of **WooOptions Pro**.
2. In your WordPress admin, go to **Plugins > Add New > Upload Plugin**, choose the `.zip` file, and click **Install Now**.
3. Activate the plugin.
4. Navigate to **WooOptions Pro > Templates** to import a pre-configured template, or click **Create an option set** to build one from scratch.
5. In the builder:
   - Drag or click elements from the left palette onto the canvas.
   - Configure field labels, options, choices, and pricing in the right-hand inspector.
   - Click **Assignments** in the top bar to choose which products or categories display this option set.
   - Click **Publish**.
6. Visit the assigned product page on your storefront to test your custom options and checkout!

---

## 💻 Local Development

WooOptions Pro includes a modern TypeScript source workflow in `resources/` with dependency-free bundling scripts:

```bash
# Install dependencies
npm install

# Run TypeScript compilation and bundle assets
npm run build

# Start watch mode for active development
npm run dev

# Run full project checks (typecheck, JS syntax, PHP syntax)
npm run check
```

---

## 🗄️ Data Retention & Uninstallation

- **Deactivation**: Deactivating the plugin preserves all your option sets, revisions, and order snapshots.
- **Uninstallation**: By default, deleting the plugin preserves database tables to prevent accidental data loss. To purge all plugin tables, options, and private uploads upon uninstallation, enable *"Delete data on uninstall"* in **WooOptions Pro > Settings** or define the following constant in `wp-config.php`:

```php
define('WOOPTIONS_PRO_REMOVE_DATA', true);
```

---

## 📄 License

WooOptions Pro is open-source software licensed under the [GNU General Public License v2.0 or later (GPL-2.0-or-later)](https://www.gnu.org/licenses/gpl-2.0.html).
