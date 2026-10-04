<?php
/**
 * Capability installation.
 *
 * @package WooOptionsPro
 */

declare(strict_types=1);

namespace WooOptionsPro\Bootstrap;

final class Capabilities {
	/**
	 * @return list<string>
	 */
	public static function all(): array {
		$capabilities = require WOOPTIONS_PRO_PATH . 'config/capabilities.php';
		return is_array($capabilities) ? array_values($capabilities) : [];
	}

	public static function add(): void {
		$administrator = get_role('administrator');
		$shop_manager  = get_role('shop_manager');

		foreach (self::all() as $capability) {
			if ($administrator) {
				$administrator->add_cap($capability);
			}

			if ($shop_manager) {
				$shop_manager->add_cap($capability);
			}
		}
	}

	public static function remove(): void {
		foreach (['administrator', 'shop_manager'] as $role_name) {
			$role = get_role($role_name);
			if (! $role) {
				continue;
			}

			foreach (self::all() as $capability) {
				$role->remove_cap($capability);
			}
		}
	}

	public static function register_hooks(): void {
		add_filter(
			'user_has_cap',
			static function ( array $allcaps ): array {
				if ( ! empty( $allcaps['manage_options'] ) || ! empty( $allcaps['manage_woocommerce'] ) ) {
					foreach ( self::all() as $cap ) {
						$allcaps[ $cap ] = true;
					}
				}
				return $allcaps;
			},
			10,
			1
		);
	}
}
