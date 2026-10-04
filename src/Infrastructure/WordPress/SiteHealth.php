<?php
/**
 * Site Health integration.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Infrastructure\WordPress;

use WooOptionsPro\Application\DiagnosticsService;

final class SiteHealth {
	public function __construct(private readonly DiagnosticsService $diagnostics) {
	}

	public function register(): void {
		add_filter('site_status_tests', [$this, 'tests']);
		add_filter('debug_information', [$this, 'debug_information']);
	}

	/**
	 * @param array<string,mixed> $tests Tests.
	 * @return array<string,mixed>
	 */
	public function tests(array $tests): array {
		$tests['direct']['wooptions-pro_runtime'] = [
			'label' => __('WooOptions Pro runtime', 'wooptions-pro'),
			'test'  => [$this, 'runtime_test'],
		];
		return $tests;
	}

	/**
	 * @return array<string,mixed>
	 */
	public function runtime_test(): array {
		$report   = $this->diagnostics->report();
		$critical = array_filter((array) $report['checks'], static fn (array $check): bool => 'critical' === ($check['status'] ?? ''));
		return [
			'label'       => [] === $critical
				? __('WooOptions Pro’s required services are ready', 'wooptions-pro')
				: __('WooOptions Pro needs attention', 'wooptions-pro'),
			'status'      => [] === $critical ? 'good' : 'critical',
			'badge'       => ['label' => __('WooOptions Pro', 'wooptions-pro'), 'color' => 'blue'],
			'description' => '<p>' . esc_html(
				[] === $critical
					? __('Database, assets, and private storage passed the runtime checks.', 'wooptions-pro')
					: __('One or more required WooOptions Pro services are unavailable.', 'wooptions-pro')
			) . '</p>',
			'actions'     => '<p><a href="' . esc_url(admin_url('admin.php?page=wooptions-pro')) . '">' . esc_html__('Open WooOptions Pro', 'wooptions-pro') . '</a></p>',
			'test'        => 'wooptions-pro_runtime',
		];
	}

	/**
	 * @param array<string,mixed> $information Debug info.
	 * @return array<string,mixed>
	 */
	public function debug_information(array $information): array {
		$report = $this->diagnostics->report();
		$information['wooptions-pro'] = [
			'label'  => __('WooOptions Pro', 'wooptions-pro'),
			'fields' => [
				'plugin'      => ['label' => __('Plugin version', 'wooptions-pro'), 'value' => $report['environment']['plugin']],
				'database'    => ['label' => __('Database version', 'wooptions-pro'), 'value' => $report['environment']['database']],
				'woocommerce' => ['label' => __('WooCommerce version', 'wooptions-pro'), 'value' => $report['environment']['woocommerce'] ?? __('Not active', 'wooptions-pro')],
			],
		];
		return $information;
	}
}
