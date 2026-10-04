<?php
/**
 * Plugin activation.
 *
 * @package WooptionsFic
 */

declare(strict_types=1);

namespace WooptionsFic\Bootstrap;

use WooptionsFic\Infrastructure\Persistence\Schema;
use WooptionsFic\Infrastructure\Storage\LocalPrivateStorage;

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

		if (! wp_next_scheduled('wooptionsfic_cleanup')) {
			wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'wooptionsfic_cleanup');
		}

		set_transient('wooptionsfic_activated', 1, 60);
	}
}
