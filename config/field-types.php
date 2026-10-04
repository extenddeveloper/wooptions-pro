<?php
/**
 * Field type manifest.
 *
 * @package WooptionsFic
 */

defined('ABSPATH') || exit;

$t = static fn (string $text): string => did_action('init') ? __($text, 'wooptionsfic') : $text;

return [
	'select'                 => ['group' => 'choice', 'label' => $t('Dropdown'), 'multiple' => false],
	'radio'                  => ['group' => 'choice', 'label' => $t('Radio group'), 'multiple' => false],
	'checkbox_group'         => ['group' => 'choice', 'label' => $t('Checkbox group'), 'multiple' => true],
	'checkbox'               => ['group' => 'boolean', 'label' => $t('Checkbox')],
	'toggle'                 => ['group' => 'boolean', 'label' => $t('Switch')],
	'segmented'              => ['group' => 'choice', 'label' => $t('Button choices'), 'multiple' => false],
	'color_swatch'           => ['group' => 'choice', 'label' => $t('Color swatches'), 'multiple' => false],
	'image_swatch'           => ['group' => 'choice', 'label' => $t('Image choices'), 'multiple' => false],
	'product'                => ['group' => 'choice', 'label' => $t('Product choices'), 'multiple' => true],
	'font'                   => ['group' => 'choice', 'label' => $t('Font choice'), 'multiple' => false],
	'text'                   => ['group' => 'scalar', 'label' => $t('Text'), 'value' => 'string'],
	'textarea'               => ['group' => 'scalar', 'label' => $t('Textarea'), 'value' => 'string'],
	'tel'                    => ['group' => 'scalar', 'label' => $t('Telephone'), 'value' => 'tel'],
	'email'                  => ['group' => 'scalar', 'label' => $t('Email'), 'value' => 'email'],
	'url'                    => ['group' => 'scalar', 'label' => $t('URL'), 'value' => 'url'],
	'number'                 => ['group' => 'scalar', 'label' => $t('Number'), 'value' => 'decimal'],
	'range'                  => ['group' => 'scalar', 'label' => $t('Range'), 'value' => 'decimal'],
	'date_range'             => ['group' => 'scalar', 'label' => $t('Date range'), 'value' => 'date_range'],
	'datetime'               => ['group' => 'scalar', 'label' => $t('Date and time'), 'value' => 'datetime'],
	'customer_defined_price' => ['group' => 'scalar', 'label' => $t('Customer-defined price'), 'value' => 'decimal'],
	'color_picker'           => ['group' => 'scalar', 'label' => $t('Color picker'), 'value' => 'color'],
	'file'                   => ['group' => 'scalar', 'label' => $t('File upload')],
	'formula'                => ['group' => 'scalar', 'label' => $t('Formula output')],
	'repeater'               => ['group' => 'content', 'label' => $t('Repeatable section')],
	'heading'                => ['group' => 'content', 'label' => $t('Heading')],
	'paragraph'              => ['group' => 'content', 'label' => $t('Paragraph')],
	'help'                   => ['group' => 'content', 'label' => $t('Help content')],
	'separator'              => ['group' => 'content', 'label' => $t('Separator')],
	'spacer'                 => ['group' => 'content', 'label' => $t('Spacer')],
	'content'                => ['group' => 'content', 'label' => $t('Content')],
	'modal'                  => ['group' => 'content', 'label' => $t('Modal')],
];
