<?php
/**
 * Bounded daily analytics aggregates.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Infrastructure\Persistence;

final class AnalyticsRepository {
	/**
	 * @param array<string,mixed> $dimension Aggregate dimension.
	 */
	public function increment(array $dimension, int $count = 1, int $revenue_minor = 0): void {
		global $wpdb;
		$table = Schema::table('analytics_daily');
		$sql   = $wpdb->prepare(
			"INSERT INTO {$table}
			(metric_date,product_id,option_set_uuid,revision_uuid,field_uuid,choice_uuid,metric_key,count_value,revenue_minor,currency)
			VALUES (%s,%d,%s,%s,%s,%s,%s,%d,%d,%s)
			ON DUPLICATE KEY UPDATE
			count_value = count_value + VALUES(count_value),
			revenue_minor = revenue_minor + VALUES(revenue_minor)",
			(string) ($dimension['date'] ?? gmdate('Y-m-d')),
			(int) ($dimension['productId'] ?? 0),
			(string) ($dimension['optionSetUuid'] ?? ''),
			(string) ($dimension['revisionUuid'] ?? ''),
			(string) ($dimension['fieldUuid'] ?? ''),
			(string) ($dimension['choiceUuid'] ?? ''),
			(string) ($dimension['metricKey'] ?? ''),
			max(0, $count),
			$revenue_minor,
			strtoupper((string) ($dimension['currency'] ?? ''))
		);
		$wpdb->query($sql);
	}

	/**
	 * @return list<array<string,mixed>>
	 */
	public function summary(string $from_date, string $to_date, int $product_id = 0): array {
		global $wpdb;
		$table      = Schema::table('analytics_daily');
		$where      = 'metric_date BETWEEN %s AND %s';
		$parameters = [$from_date, $to_date];
		if ($product_id > 0) {
			$where       .= ' AND product_id = %d';
			$parameters[] = $product_id;
		}
		$sql = $wpdb->prepare(
			"SELECT metric_key, currency, SUM(count_value) AS total_count,
			 SUM(revenue_minor) AS total_revenue_minor
			 FROM {$table} WHERE {$where}
			 GROUP BY metric_key, currency ORDER BY metric_key ASC",
			$parameters
		);
		$rows = $wpdb->get_results($sql, ARRAY_A);
		return array_map(
			static fn (array $row): array => [
				'metricKey'   => (string) $row['metric_key'],
				'currency'    => (string) $row['currency'],
				'count'       => (int) $row['total_count'],
				'revenueMinor'=> (int) $row['total_revenue_minor'],
			],
			is_array($rows) ? $rows : []
		);
	}

	/**
	 * Daily metrics timeseries.
	 *
	 * @return list<array<string,mixed>>
	 */
	public function timeseries(string $from_date, string $to_date, int $product_id = 0): array {
		global $wpdb;
		$table      = Schema::table('analytics_daily');
		$where      = 'metric_date BETWEEN %s AND %s';
		$parameters = [$from_date, $to_date];
		if ($product_id > 0) {
			$where       .= ' AND product_id = %d';
			$parameters[] = $product_id;
		}
		$sql = $wpdb->prepare(
			"SELECT metric_date, metric_key, currency, SUM(count_value) AS total_count,
			 SUM(revenue_minor) AS total_revenue_minor
			 FROM {$table} WHERE {$where}
			 GROUP BY metric_date, metric_key, currency
			 ORDER BY metric_date ASC",
			$parameters
		);
		$rows = $wpdb->get_results($sql, ARRAY_A);
		return array_map(
			static fn (array $row): array => [
				'date'        => (string) $row['metric_date'],
				'metricKey'   => (string) $row['metric_key'],
				'currency'    => (string) $row['currency'],
				'count'       => (int) $row['total_count'],
				'revenueMinor'=> (int) $row['total_revenue_minor'],
			],
			is_array($rows) ? $rows : []
		);
	}

	/**
	 * Option set breakdown with performance metrics.
	 *
	 * @return list<array<string,mixed>>
	 */
	public function option_sets_breakdown(string $from_date, string $to_date): array {
		global $wpdb;
		$sets_table        = Schema::table('option_sets');
		$analytics_table   = Schema::table('analytics_daily');
		$assignments_table = Schema::table('assignments');

		$sets = $wpdb->get_results(
			"SELECT id, uuid, title, status FROM {$sets_table} WHERE status != 'archived' ORDER BY id DESC",
			ARRAY_A
		);
		if (! is_array($sets) || empty($sets)) {
			return [];
		}

		$assignments = $wpdb->get_results(
			"SELECT option_set_id, target_type, target_id FROM {$assignments_table} ORDER BY priority ASC, id ASC",
			ARRAY_A
		);
		$assignments_map   = [];
		$first_product_map = [];
		$first_cat_map     = [];
		if (is_array($assignments)) {
			foreach ($assignments as $a) {
				$set_id = (int) $a['option_set_id'];
				$ttype  = (string) $a['target_type'];
				$assignments_map[$set_id][$ttype] = ($assignments_map[$set_id][$ttype] ?? 0) + 1;
				if ('product' === $ttype && ! isset($first_product_map[$set_id]) && ! empty($a['target_id'])) {
					$first_product_map[$set_id] = (int) $a['target_id'];
				}
				if ('category' === $ttype && ! isset($first_cat_map[$set_id]) && ! empty($a['target_id'])) {
					$first_cat_map[$set_id] = (int) $a['target_id'];
				}
			}
		}

		$sql = $wpdb->prepare(
			"SELECT option_set_uuid, metric_key, currency, SUM(count_value) AS total_count,
			 SUM(revenue_minor) AS total_revenue_minor
			 FROM {$analytics_table}
			 WHERE metric_date BETWEEN %s AND %s AND option_set_uuid != ''
			 GROUP BY option_set_uuid, metric_key, currency",
			$from_date,
			$to_date
		);
		$metrics_rows = $wpdb->get_results($sql, ARRAY_A);
		$metrics_map  = [];
		if (is_array($metrics_rows)) {
			foreach ($metrics_rows as $row) {
				$uuid = (string) $row['option_set_uuid'];
				$key  = (string) $row['metric_key'];
				if (! isset($metrics_map[$uuid])) {
					$metrics_map[$uuid] = [
						'view'          => 0,
						'interaction'   => 0,
						'add_to_cart'   => 0,
						'purchase'      => 0,
						'revenue_minor' => 0,
					];
				}
				if ('option_revenue' === $key) {
					$metrics_map[$uuid]['revenue_minor'] += (int) $row['total_revenue_minor'];
				} else {
					$metrics_map[$uuid][$key] = ($metrics_map[$uuid][$key] ?? 0) + (int) $row['total_count'];
				}
			}
		}

		$results = [];
		foreach ($sets as $set) {
			$id   = (int) $set['id'];
			$uuid = (string) $set['uuid'];
			$asg  = $assignments_map[$id] ?? [];

			$applied_text  = '0 Products';
			$product_count = 0;
			if (isset($asg['global']) && $asg['global'] > 0) {
				$applied_text = 'All Products';
			} elseif (isset($asg['product']) && $asg['product'] > 0) {
				$product_count = $asg['product'];
				$applied_text  = $product_count === 1 ? '1 Products' : $product_count . ' Products';
			} elseif (isset($asg['category']) && $asg['category'] > 0) {
				$applied_text = $asg['category'] . ' Categories';
			}

			$m           = $metrics_map[$uuid] ?? ['view' => 0, 'interaction' => 0, 'add_to_cart' => 0, 'purchase' => 0, 'revenue_minor' => 0];
			$views       = (int) ($m['view'] ?? 0);
			$clicks      = (int) ($m['interaction'] ?? 0);
			$add_to_cart = (int) ($m['add_to_cart'] ?? 0);
			$orders      = (int) ($m['purchase'] ?? 0);
			$revenue_min = (int) ($m['revenue_minor'] ?? 0);
			$sales       = round($revenue_min / 100, 2);

			$click_rate  = $views > 0 ? (int) round(($clicks / $views) * 100) : ($clicks > 0 ? 100 : 0);
			$cart_rate   = $views > 0 ? (int) round(($add_to_cart / $views) * 100) : ($add_to_cart > 0 ? 100 : 0);

			$product_image_url = '';
			$first_pid         = $first_product_map[$id] ?? 0;
			if ($first_pid > 0) {
				$thumb_id = 0;
				if (function_exists('wc_get_product')) {
					$prod = wc_get_product($first_pid);
					if ($prod && method_exists($prod, 'get_image_id')) {
						$thumb_id = (int) $prod->get_image_id();
					}
				}
				if (! $thumb_id && function_exists('get_post_thumbnail_id')) {
					$thumb_id = (int) get_post_thumbnail_id($first_pid);
				}
				if ($thumb_id > 0) {
					$thumb = wp_get_attachment_image_url($thumb_id, 'thumbnail');
					if ($thumb) {
						$product_image_url = (string) $thumb;
					}
				}
				if ('' === $product_image_url && function_exists('wc_placeholder_img_src')) {
					$product_image_url = (string) wc_placeholder_img_src('woocommerce_thumbnail');
				}
			} elseif (isset($asg['global']) && $asg['global'] > 0) {
				if (function_exists('wc_get_products')) {
					$prods = wc_get_products(['limit' => 1, 'status' => 'publish']);
					if (! empty($prods) && method_exists($prods[0], 'get_image_id')) {
						$thumb_id = (int) $prods[0]->get_image_id();
						if ($thumb_id > 0) {
							$thumb = wp_get_attachment_image_url($thumb_id, 'thumbnail');
							if ($thumb) {
								$product_image_url = (string) $thumb;
							}
						}
					}
				}
				if ('' === $product_image_url && function_exists('wc_placeholder_img_src')) {
					$product_image_url = (string) wc_placeholder_img_src('woocommerce_thumbnail');
				}
			} elseif (isset($asg['category']) && $asg['category'] > 0 && ! empty($first_cat_map[$id])) {
				if (function_exists('wc_get_products') && function_exists('get_term')) {
					$cat_term = get_term($first_cat_map[$id], 'product_cat');
					$cat_slug = ($cat_term && ! is_wp_error($cat_term)) ? $cat_term->slug : '';
					if ($cat_slug) {
						$cat_prods = wc_get_products([
							'category' => [$cat_slug],
							'limit'    => 1,
							'status'   => 'publish',
						]);
						if (! empty($cat_prods) && method_exists($cat_prods[0], 'get_image_id')) {
							$thumb_id = (int) $cat_prods[0]->get_image_id();
							if ($thumb_id > 0) {
								$thumb = wp_get_attachment_image_url($thumb_id, 'thumbnail');
								if ($thumb) {
									$product_image_url = (string) $thumb;
								}
							}
						}
					}
				}
				if ('' === $product_image_url && function_exists('wc_placeholder_img_src')) {
					$product_image_url = (string) wc_placeholder_img_src('woocommerce_thumbnail');
				}
			}

			$results[] = [
				'id'            => $id,
				'uuid'          => $uuid,
				'name'          => ! empty($set['title']) ? (string) $set['title'] : 'Untitled',
				'appliedText'   => $applied_text,
				'productCount'  => $product_count,
				'thumbnailUrl'  => $product_image_url,
				'clickRate'     => $click_rate,
				'addToCartRate' => $cart_rate,
				'sales'         => $sales,
				'orders'        => $orders,
				'clicks'        => $clicks,
				'addToCart'     => $add_to_cart,
				'views'         => $views,
			];
		}

		return $results;
	}

	public function prune_before(string $date): int {
		global $wpdb;
		$table = Schema::table('analytics_daily');
		return (int) $wpdb->query($wpdb->prepare("DELETE FROM {$table} WHERE metric_date < %s", $date));
	}
}
