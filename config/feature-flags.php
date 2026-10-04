<?php
/**
 * Production feature flags.
 *
 * Experimental behavior is deliberately absent from the customer UI.
 *
 * @package WooOptionsPro
 */

defined('ABSPATH') || exit;

return [
	'experiments'            => false,
	'ai_formula_assistance'  => false,
	'remote_fonts'           => false,
	'arbitrary_shortcodes'   => false,
	'nested_repeaters'       => false,
	'guest_saved_configs'    => true,
	'private_uploads'        => true,
	'privacy_safe_analytics' => true,
];
