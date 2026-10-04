<?php
/**
 * Plugin deactivation.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Bootstrap;

final class Deactivation {
	public static function deactivate(bool $network_wide = false): void {
		if (is_multisite() && $network_wide) {
			$site_ids = get_sites(['fields' => 'ids', 'number' => 0]);
			foreach ($site_ids as $site_id) {
				switch_to_blog((int) $site_id);
				wp_clear_scheduled_hook('wooptions-pro_cleanup');
				restore_current_blog();
			}
			return;
		}

		wp_clear_scheduled_hook('wooptions-pro_cleanup');
	}
}
