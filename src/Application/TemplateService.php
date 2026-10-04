<?php
/**
 * Bundled template catalog.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use JsonException;
use RuntimeException;

final class TemplateService {
	public function __construct(private readonly OptionSetService $option_sets) {
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function list(): array {
		$manifest = $this->manifest();
		return array_values(
			array_map(
				static function (array $item): array {
					$slug = sanitize_file_name((string) $item['slug']);
					$img_url = WOOPTIONS_PRO_URL . 'assets/templates/' . $slug . '.jpg';

					$hero_file = WOOPTIONS_PRO_PATH . 'assets/templates/' . $slug . '-large.jpg';
					$hero_url = file_exists($hero_file)
						? WOOPTIONS_PRO_URL . 'assets/templates/' . $slug . '-large.jpg'
						: $img_url;

					$file = WOOPTIONS_PRO_PATH . 'templates/' . $slug . '.json';
					$actual_fields = null;
					$actual_rules = null;
					if (is_readable($file)) {
						$raw = (string) file_get_contents($file);
						$data = json_decode($raw, true);
						if (is_array($data) && isset($data['optionSet']['definition']['fields']) && is_array($data['optionSet']['definition']['fields'])) {
							$actual_fields = count($data['optionSet']['definition']['fields']);
							$actual_rules = count($data['optionSet']['definition']['rules'] ?? []);
						}
					}

					$fields_count = $actual_fields !== null ? $actual_fields : (int) ($item['fieldsCount'] ?? $item['fieldCount'] ?? 0);
					$rules_count = $actual_rules !== null ? $actual_rules : (int) ($item['rulesCount'] ?? 0);

					$details = is_array($item['details'] ?? null) ? $item['details'] : [];
					$details['fields'] = $fields_count . ' ' . ($fields_count === 1 ? __('field', 'wooptions-pro') : __('fields', 'wooptions-pro'));
					$details['rules'] = $rules_count . ' ' . ($rules_count === 1 ? __('rule', 'wooptions-pro') : __('rules', 'wooptions-pro'));

					return [
						'slug'          => (string) $item['slug'],
						'name'          => (string) $item['name'],
						'level'         => (string) ($item['level'] ?? 'Beginner'),
						'description'   => (string) $item['description'],
						'icon'          => (string) ($item['icon'] ?? 'screenoptions'),
						'category'      => (string) ($item['category'] ?? 'commerce'),
						'categoryLabel' => (string) ($item['categoryLabel'] ?? $item['category'] ?? 'Commerce'),
						'fieldCount'    => $fields_count,
						'fieldsCount'   => $fields_count,
						'rulesCount'    => $rules_count,
						'pricingModel'  => (string) ($item['pricingModel'] ?? 'Cumulative pricing'),
						'layoutModel'   => (string) ($item['layoutModel'] ?? 'Grid layout'),
						'tested'        => ! empty($item['tested']),
						'previewImage'  => $img_url,
						'heroImage'     => $hero_url,
						'features'      => array_values(array_map('strval', (array) ($item['features'] ?? []))),
						'details'       => $details,
						'footerIcons'   => array_values(array_map('strval', (array) ($item['footerIcons'] ?? []))),
						'fieldTypes'    => array_values(array_map('strval', (array) ($item['fieldTypes'] ?? []))),
						'usage'         => (int) ($item['usage'] ?? 0),
						'popularity'    => (int) ($item['popularity'] ?? 0),
						'order'         => (int) ($item['order'] ?? 0),
						'previewUrl'    => (string) ($item['previewUrl'] ?? ''),
					];
				},
				$manifest
			)
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function load(string $slug): array {
		$slug = sanitize_key($slug);
		foreach ($this->manifest() as $item) {
			if ($slug !== $item['slug']) {
				continue;
			}
			$file = WOOPTIONS_PRO_PATH . 'templates/' . $slug . '.json';
			if (! is_readable($file)) {
				throw new RuntimeException('wooptions-pro_template_file_missing');
			}
			try {
				$data = json_decode((string) file_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
			} catch (JsonException) {
				throw new ValidationException('wooptions-pro_template_invalid', [['code' => 'template_json_invalid']]);
			}
			if (! is_array($data) || ! is_array($data['optionSet']['definition'] ?? null)) {
				throw new ValidationException('wooptions-pro_template_invalid', [['code' => 'template_schema_invalid']]);
			}
			return $data;
		}
		throw new NotFoundException('wooptions-pro_template_not_found');
	}

	/**
	 * @return array<string,mixed>
	 */
	public function import(string $slug, int $user_id): array {
		$template = $this->load($slug);
		return $this->option_sets->import(
			(array) $template['optionSet']['definition'],
			(string) ($template['optionSet']['title'] ?? ''),
			$user_id
		);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	private function manifest(): array {
		$file = WOOPTIONS_PRO_PATH . 'templates/manifest.php';
		$data = is_readable($file) ? require $file : [];
		return is_array($data) ? array_values(array_filter($data, 'is_array')) : [];
	}
}
