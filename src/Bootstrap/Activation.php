<?php
/**
 * Plugin activation.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Bootstrap;

use WooOptionsPro\Infrastructure\Persistence\Schema;
use WooOptionsPro\Infrastructure\Storage\LocalPrivateStorage;

final class Activation {
	public static function activate(bool $network_wide = false): void {
		Requirements::assert_activation_requirements();

		if (is_multisite() && $network_wide) {
			$site_ids = get_sites(['fields' => 'ids', 'number' => 0]);
			foreach ($site_ids as $site_id) {
				switch_to_blog((int) $site_id);
				self::activate_site();
				restore_current_blog();
			}
		} else {
			self::activate_site();
		}
	}

	private static function activate_site(): void {
		Schema::migrate();
		Capabilities::add();
		Settings::install_defaults();

		$storage = new LocalPrivateStorage();
		$storage->ensure_vault();

		if (! wp_next_scheduled('wooptions-pro_cleanup')) {
			wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'wooptions-pro_cleanup');
		}

		set_transient('wooptions-pro_activated', 1, 60);
	}
}
