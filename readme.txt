=== WooptionsFic - Product Options for WooCommerce ===
Contributors: wooptionsfic
Tags: woocommerce, product options, conditional logic, formula pricing, product addons, custom fields, product configurator
Requires at least: 6.9
Requires PHP: 8.1
Requires Plugins: woocommerce
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build accessible, styled, server-validated WooCommerce product configurators and custom product addons without editing theme code.

== Description ==

WooptionsFic is a powerful, modern, accessible product options and configurator plugin for WooCommerce. It provides an intuitive WordPress-native React builder (Precision Workshop) with real-time preview, advanced conditional logic, dynamic formula pricing, customizable color palettes, and 13 ready-to-use templates.

All pricing and conditional rules are revalidated securely on the server with PHP. Client-side price tampering is impossible. Published revisions are immutable, ensuring every cart and order snapshot preserves the exact options selected by the customer.

= Highlights =

* 34+ registered field and layout elements (Text, Numbers, Swatches, Dropdowns, Images, Repeaters, Uploads, Formulas, and more).
* Advanced pricing models: Flat, percentage, quantity-based, per-character, per-unit, tiered, customer-defined, and AST-parsed math formulas.
* Dynamic conditional logic with nested AND/OR rules to show, hide, require, or disable fields in real time.
* 13 pre-designed starter templates (Pizza builder, Gourmet burger, Apparel, Flower bouquet, Custom mug, Pet harness, Gift box, Engraving, Curtains, PC builder, Donations, Rentals, Team roster).
* Built-in Design Studio with curated palettes, customizable color tokens, and contrast accessibility validation.
* Repeatable sections (repeaters) with server-enforced row limits and stable keys.
* Secure private uploads with MIME detection, file-size limits, dimension checks, and authenticated access.
* Deterministic product, category, tag, and global assignments with include/exclude rules.
* Revision history with point-in-time rollback and immutable published records.
* Native Gutenberg Product Options block plus classic WooCommerce storefront hook integration.

== Installation ==

1. In WordPress, navigate to Plugins > Add New > Upload Plugin.
2. Select the plugin ZIP file and click Install Now, then Activate.
3. Ensure WooCommerce 9.0 or newer is installed and active.
4. Navigate to WooptionsFic > Templates to explore starter templates or create a custom Option Set.
5. Add fields, configure conditional logic and pricing, and assign to your products or categories.
6. Click Publish to make your product options live.

== Frequently Asked Questions ==

= Does JavaScript decide the final price? =

No. While the browser provides instant visual feedback, the final add-to-cart and checkout calculations are strictly computed on the server using PHP normalizers, rule engines, and price calculators.

= Are uploaded files protected? =

Yes. Customer uploads use unique opaque identifiers and are stored in a protected, private directory rather than the public Media Library. Only authorized store managers or the ordering customer can access them.

= Can I customize the styling of the options? =

Yes. WooptionsFic includes a built-in Style Studio allowing you to select from pre-designed color palettes or customize individual colors, typography, borders, and layouts to match your store theme.

= What happens when I update a published option set? =

Published revisions are immutable. When you edit a published set, a working draft is created. When you publish your changes, a new revision is created. Existing customer carts and past orders retain the snapshot of the revision they purchased under.

= Does uninstalling remove all my data? =

Not by default. Data is preserved so you do not accidentally lose your configuration. If you wish to wipe plugin data upon uninstallation, enable "Delete data on uninstall" in settings or define `WOOPTIONSFIC_REMOVE_DATA` as true in `wp-config.php`.

== Changelog ==

= 1.0.0 =
* Initial official production release.
* Added 13 pre-designed templates with full field specifications and conditional rules.
* Modernized Dashboard interface with quick actions, template showcase, and beginner resources.
* Refined title editor with modern inline pill styling and SVG pencil icon.
* Upgraded color palette selector with SVG verification checkmarks.
* Streamlined builder interface and removed legacy diagnostics toggle.
* Full compatibility with WooCommerce 9.0+ and WordPress 6.9+.
* Revalidated all 34 field types, formula engine, and server-side pricing recalculation.
