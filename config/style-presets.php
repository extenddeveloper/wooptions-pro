<?php
/**
 * Built-in storefront palettes.
 *
 * @package WooptionsFic
 */

defined('ABSPATH') || exit;

$t = static fn (string $text): string => did_action('init') ? __($text, 'wooptionsfic') : $text;

return [
	'theme-native' => [
		'name' => $t('Theme Native'),
		'tokens' => [
			'primary' => 'currentColor', 'onPrimary' => 'Canvas', 'accent' => 'currentColor',
			'background' => 'transparent', 'surface' => 'transparent', 'text' => 'currentColor',
			'muted' => 'currentColor', 'border' => 'currentColor', 'danger' => '#C7353A',
			'success' => '#147A4A', 'focus' => '#5B4FF5',
		],
	],
	'iris-studio' => [
		'name' => $t('Iris Studio'),
		'tokens' => [
			'primary' => '#5B4FF5', 'onPrimary' => '#FFFFFF', 'accent' => '#0F766E',
			'background' => '#F7F7FC', 'surface' => '#FFFFFF', 'text' => '#172033',
			'muted' => '#5E6A7D', 'border' => '#D8DEEA', 'danger' => '#C7353A',
			'success' => '#147A4A', 'focus' => '#6D5DFB',
		],
	],
	'ocean-commerce' => [
		'name' => $t('Ocean Commerce'),
		'tokens' => [
			'primary' => '#0369A1', 'onPrimary' => '#FFFFFF', 'accent' => '#0F766E',
			'background' => '#F0F9FF', 'surface' => '#FFFFFF', 'text' => '#0C2B3A',
			'muted' => '#365B6D', 'border' => '#BAE6FD', 'danger' => '#B42318',
			'success' => '#147A4A', 'focus' => '#0369A1',
		],
	],
	'ember-craft' => [
		'name' => $t('Ember Craft'),
		'tokens' => [
			'primary' => '#C2410C', 'onPrimary' => '#FFFFFF', 'accent' => '#A16207',
			'background' => '#FFF7ED', 'surface' => '#FFFFFF', 'text' => '#292524',
			'muted' => '#6B5C55', 'border' => '#FED7AA', 'danger' => '#B42318',
			'success' => '#166534', 'focus' => '#C2410C',
		],
	],
	'forest-atelier' => [
		'name' => $t('Forest Atelier'),
		'tokens' => [
			'primary' => '#166534', 'onPrimary' => '#FFFFFF', 'accent' => '#A16207',
			'background' => '#F8FAF5', 'surface' => '#FFFFFF', 'text' => '#142012',
			'muted' => '#53604F', 'border' => '#D6D3D1', 'danger' => '#B42318',
			'success' => '#166534', 'focus' => '#166534',
		],
	],
	'mono-luxe' => [
		'name' => $t('Mono Luxe'),
		'tokens' => [
			'primary' => '#18181B', 'onPrimary' => '#FFFFFF', 'accent' => '#A16207',
			'background' => '#FAFAFA', 'surface' => '#FFFFFF', 'text' => '#18181B',
			'muted' => '#52525B', 'border' => '#D4D4D8', 'danger' => '#B42318',
			'success' => '#166534', 'focus' => '#52525B',
		],
	],
	'night-studio' => [
		'name' => $t('Night Studio'),
		'tokens' => [
			'primary' => '#8B80FF', 'onPrimary' => '#0E1420', 'accent' => '#3CC8B4',
			'background' => '#0E1420', 'surface' => '#151D2B', 'text' => '#F6F8FC',
			'muted' => '#AAB4C5', 'border' => '#334158', 'danger' => '#FF7B82',
			'success' => '#52D58A', 'focus' => '#B0A8FF',
		],
	],
];
