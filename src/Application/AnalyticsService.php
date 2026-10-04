<?php
/**
 * Privacy-safe analytics policy and recording.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Application;

use WooOptionsPro\Bootstrap\Settings;
use WooOptionsPro\Infrastructure\Persistence\AnalyticsRepository;

final class AnalyticsService {
	private const ALLOWED_METRICS = [
		'view', 'interaction', 'validation_error', 'add_to_cart', 'purchase',
		'formula_warning', 'option_revenue',
	];

	public function __construct(private readonly AnalyticsRepository $repository) {
	}

	/**
	 * @param array<string,mixed> $dimension Non-sensitive dimensions.
	 */
	public function record(string $metric, array $dimension = [], int $count = 1, int $revenue_minor = 0): void {
		if (! Settings::get('analytics_enabled', true) || ! in_array($metric, self::ALLOWED_METRICS, true)) {
			return;
		}
		$dimension['metricKey'] = $metric;
		$dimension['date']      = gmdate('Y-m-d');
		foreach (['optionSetUuid', 'revisionUuid', 'fieldUuid', 'choiceUuid'] as $key) {
			$value = (string) ($dimension[$key] ?? '');
			$dimension[$key] = 1 === preg_match('/\A[0-9a-f-]{36}\z/i', $value) ? strtolower($value) : '';
		}
		$dimension['productId'] = max(0, (int) ($dimension['productId'] ?? 0));
		$dimension['currency']  = 1 === preg_match('/\A[A-Z]{3}\z/', strtoupper((string) ($dimension['currency'] ?? '')))
			? strtoupper((string) $dimension['currency'])
			: '';
		$this->repository->increment($dimension, max(0, $count), $revenue_minor);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function summary(string $range = '30d', string $from = '', string $to = '', int $product_id = 0): array {
		if (1 === preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $range)) {
			$from  = $range;
			$range = 'custom';
		}

		if ('7d' === $range) {
			$from = gmdate('Y-m-d', strtotime('-6 days'));
			$to   = gmdate('Y-m-d');
		} elseif ('12m' === $range) {
			$from = gmdate('Y-m-d', strtotime('-364 days'));
			$to   = gmdate('Y-m-d');
		} elseif ('custom' === $range) {
			$from = $this->date($from, gmdate('Y-m-d', strtotime('-29 days')));
			$to   = $this->date($to, gmdate('Y-m-d'));
		} else {
			$range = '30d';
			$from  = gmdate('Y-m-d', strtotime('-29 days'));
			$to    = gmdate('Y-m-d');
		}

		$raw_metrics = $this->repository->summary($from, $to, $product_id);
		$total_sales = 0.0;
		$total_orders = 0;
		$clicks_count = 0;
		$add_to_cart_count = 0;
		$views_count = 0;

		foreach ($raw_metrics as $m) {
			$key   = (string) ($m['metricKey'] ?? '');
			$count = (int) ($m['count'] ?? 0);
			$rev   = (int) ($m['revenueMinor'] ?? 0);

			if ('option_revenue' === $key) {
				$total_sales += round($rev / 100, 2);
			} elseif ('purchase' === $key) {
				$total_orders += $count;
			} elseif ('interaction' === $key) {
				$clicks_count += $count;
			} elseif ('add_to_cart' === $key) {
				$add_to_cart_count += $count;
			} elseif ('view' === $key) {
				$views_count += $count;
			}
		}

		$timeseries_rows = $this->repository->timeseries($from, $to, $product_id);
		$daily_map       = [];
		foreach ($timeseries_rows as $row) {
			$d = (string) $row['date'];
			$k = (string) $row['metricKey'];
			if (! isset($daily_map[$d])) {
				$daily_map[$d] = [
					'clicks'    => 0,
					'addToCart' => 0,
					'orders'    => 0,
					'sales'     => 0.0,
					'views'     => 0,
				];
			}
			if ('interaction' === $k) {
				$daily_map[$d]['clicks'] += (int) $row['count'];
			} elseif ('add_to_cart' === $k) {
				$daily_map[$d]['addToCart'] += (int) $row['count'];
			} elseif ('purchase' === $k) {
				$daily_map[$d]['orders'] += (int) $row['count'];
			} elseif ('view' === $k) {
				$daily_map[$d]['views'] += (int) $row['count'];
			} elseif ('option_revenue' === $k) {
				$daily_map[$d]['sales'] += round(((int) $row['revenueMinor']) / 100, 2);
			}
		}

		$chart = [];
		if ('12m' === $range) {
			$start_month = strtotime('-11 months', strtotime(gmdate('Y-m-01')));
			for ($i = 0; $i < 12; $i++) {
				$m_time    = strtotime("+{$i} months", $start_month);
				$month_key = gmdate('Y-m', $m_time);
				$label     = gmdate('M - y', $m_time);
				$clicks    = 0;
				$addToCart = 0;
				$orders    = 0;
				$sales     = 0.0;
				$views     = 0;
				foreach ($daily_map as $ymd => $data) {
					if (str_starts_with($ymd, $month_key)) {
						$clicks    += $data['clicks'];
						$addToCart += $data['addToCart'];
						$orders    += $data['orders'];
						$sales     += $data['sales'];
						$views     += $data['views'];
					}
				}
				$chart[] = [
					'date'      => $month_key,
					'label'     => $label,
					'clicks'    => $clicks,
					'addToCart' => $addToCart,
					'orders'    => $orders,
					'sales'     => round($sales, 2),
					'views'     => $views,
				];
			}
		} else {
			$current = strtotime($from);
			$end     = strtotime($to);
			while ($current <= $end) {
				$ymd   = gmdate('Y-m-d', $current);
				$label = gmdate('j - M', $current);
				$data  = $daily_map[$ymd] ?? [
					'clicks'    => 0,
					'addToCart' => 0,
					'orders'    => 0,
					'sales'     => 0.0,
					'views'     => 0,
				];

				$chart[] = [
					'date'      => $ymd,
					'label'     => $label,
					'clicks'    => (int) $data['clicks'],
					'addToCart' => (int) $data['addToCart'],
					'orders'    => (int) $data['orders'],
					'sales'     => (float) $data['sales'],
					'views'     => (int) $data['views'],
				];

				$current = strtotime('+1 day', $current);
			}
		}

		$option_sets = $this->repository->option_sets_breakdown($from, $to);

		$currency          = function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : 'USD';
		$currency_symbol   = function_exists('get_woocommerce_currency_symbol') ? html_entity_decode((string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8') : '$';
		$currency_position = function_exists('get_option') ? (string) get_option('woocommerce_currency_pos', 'right') : 'right';

		return [
			'range'            => $range,
			'from'             => $from,
			'to'               => $to,
			'currency'         => $currency,
			'currencySymbol'   => $currency_symbol,
			'currencyPosition' => $currency_position,
			'totals'           => [
				'totalSales'     => $total_sales,
				'totalOrders'    => $total_orders,
				'clicksCount'    => $clicks_count,
				'addToCartCount' => $add_to_cart_count,
				'viewsCount'     => $views_count,
			],
			'chart'            => $chart,
			'optionSets'       => $option_sets,
			'metrics'          => $raw_metrics,
			'definitions'      => [
				'view'             => 'A server-rendered applicable option form.',
				'interaction'      => 'The first meaningful non-sensitive field interaction.',
				'validation_error' => 'A server validation error, grouped by field UUID only.',
				'add_to_cart'      => 'A configured line accepted into the cart.',
				'purchase'         => 'A configured order line created.',
				'option_revenue'   => 'The minor-unit option contribution stored on purchased lines.',
			],
		];
	}

	public function prune(): int {
		$retention = max(30, min(1095, (int) Settings::get('analytics_retention_days', 395)));
		return $this->repository->prune_before(gmdate('Y-m-d', strtotime('-' . $retention . ' days')));
	}

	private function date(string $value, string $fallback): string {
		return 1 === preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $value) ? $value : $fallback;
	}
}
