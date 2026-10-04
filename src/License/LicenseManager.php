<?php
/**
 * WooOptions Pro Elite Licenser bootstrap and feature gate coordinator.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License;

use WooOptionsPro\License\Updater\EliteLicensing;
use WooOptionsPro\License\Updater\LicenseSettings;

defined( 'ABSPATH' ) || exit;

/**
 * License controller and manager.
 */
class LicenseManager {

	/** Option containing the boolean feature-gate state. */
	const STATUS_OPTION = 'wooptions_pro_license_status';

	/** @var bool|null In-request cache. */
	private static $active_cache = null;

	/** @var EliteLicensing|null Licensing client. */
	private $licensing = null;

	/**
	 * Boot Elite Licenser, updater, admin UI, and feature gate.
	 *
	 * @return void
	 */
	public function init() {
		try {
			$licensing = ( new EliteLicensing() )->register(
				array(
					'version'      => defined( 'WOOPTIONS_PRO_VERSION' ) ? WOOPTIONS_PRO_VERSION : '1.0.0',
					'product_id'   => '13',
					'product_base' => 'woooptions-pro',
					'basename'     => defined( 'WOOPTIONS_PRO_BASENAME' ) ? WOOPTIONS_PRO_BASENAME : '',
					'plugin_file'  => defined( 'WOOPTIONS_PRO_FILE' ) ? WOOPTIONS_PRO_FILE : '',
					'slug'         => 'wooptions-pro',
					'server_url'   => 'https://license.themefic.com/wp-json/licensor/',
					'request_key'  => '0788A6B548D50039',
					'settings_key' => 'wooptions_pro_elite_license',
				)
			);
		} catch ( \Exception $exception ) {
			update_option( self::STATUS_OPTION, false, false );
			$this->register_gate_filter( false );
			add_action(
				'admin_notices',
				function () use ( $exception ) {
					if ( current_user_can( 'manage_options' ) ) {
						printf(
							'<div class="notice notice-error"><p><strong>%1$s</strong> %2$s</p></div>',
							esc_html__( 'WooOptions Pro licensing could not start:', 'wooptions-pro' ),
							esc_html( $exception->getMessage() )
						);
					}
				}
			);
			return;
		}

		$this->licensing = $licensing;
		add_action( 'init', array( $this, 'register_license_settings' ) );

		$status = $this->resolve_status( $licensing );
		update_option( self::STATUS_OPTION, $status, false );
		self::$active_cache = $status;

		LicenseGate::reset_cache();
		$this->register_gate_filter( $status );

		add_action( 'admin_notices', array( $this, 'maybe_render_notice' ) );
	}

	/**
	 * Register the LicenseSettings page and AJAX handlers on init.
	 *
	 * @return void
	 */
	public function register_license_settings() {
		if ( ! $this->licensing ) {
			return;
		}

		( new LicenseSettings() )
			->register( $this->licensing )
			->setConfig(
				array(
					'menu_title'   => __( 'License', 'wooptions-pro' ),
					'page_title'   => __( 'WooOptions Pro License', 'wooptions-pro' ),
					'title'        => __( 'License', 'wooptions-pro' ),
					'license_key'  => __( 'License Key', 'wooptions-pro' ),
					'purchase_url' => 'https://themefic.com/plugins/woooptions-pro/',
					'account_url'  => 'https://portal.themefic.com/my-account/',
					'plugin_name'  => 'WooOptions Pro',
				)
			)
			->addPage(
				array(
					'type'        => 'submenu',
					'parent_slug' => 'wooptions-pro',
					'menu_slug'   => 'wooptions-pro-license',
				)
			);
	}

	/**
	 * Resolve normalized Elite status.
	 *
	 * @param EliteLicensing $licensing Client.
	 * @return bool
	 */
	private function resolve_status( $licensing ) {
		$status = $licensing->getStatus( false );
		if ( is_wp_error( $status ) || ! is_array( $status ) ) {
			return false;
		}
		$has_key = ! empty( $status['license_key'] );
		return $has_key && in_array( $status['status'], array( 'valid', 'grace' ), true ) && empty( $status['is_expired'] );
	}

	/**
	 * Register the public gate filter.
	 *
	 * @param bool $status Active status.
	 * @return void
	 */
	private function register_gate_filter( $status ) {
		add_filter(
			'wooptions_pro_license_active',
			function () use ( $status ) {
				return (bool) $status;
			}
		);
	}

	/**
	 * Determine whether premium features may configure.
	 *
	 * @return bool
	 */
	public static function is_active() {
		if ( defined( 'WOOPTIONS_PRO_LICENSE_FORCE_ACTIVE' ) && WOOPTIONS_PRO_LICENSE_FORCE_ACTIVE ) {
			return true;
		}

		return LicenseGate::can_configure();
	}

	/**
	 * Whether saved storefront configuration may keep running.
	 *
	 * @return bool
	 */
	public static function can_run_saved_configuration() {
		return LicenseGate::can_run_saved_configuration();
	}

	/**
	 * Return masked license key if active.
	 *
	 * @return string
	 */
	public static function get_masked_key() {
		$raw = get_option( 'wooptions_pro_elite_license', array() );
		$key = ! empty( $raw['license_key'] ) ? (string) $raw['license_key'] : '';
		if ( empty( $key ) ) {
			return '';
		}
		return LicenseSettings::mask_license_key( $key );
	}

	/**
	 * Return expiry date string.
	 *
	 * @return string
	 */
	public static function get_expiry() {
		$raw = get_option( 'wooptions_pro_elite_license', array() );
		return isset( $raw['expires'] ) && '' !== $raw['expires'] ? (string) $raw['expires'] : 'Lifetime';
	}

	/**
	 * Return license type / title.
	 *
	 * @return string
	 */
	public static function get_license_title() {
		$raw = get_option( 'wooptions_pro_elite_license', array() );
		return ! empty( $raw['license_title'] ) ? (string) $raw['license_title'] : 'Unlimited Site (Lifetime)';
	}

	/**
	 * Return support expiry string.
	 *
	 * @return string
	 */
	public static function get_support_expiry() {
		$raw = get_option( 'wooptions_pro_elite_license', array() );
		return ! empty( $raw['support_expires'] ) ? (string) $raw['support_expires'] : 'Unlimited';
	}

	/**
	 * Show activation notice on Dashboard and WooOptions Pro screens when not active.
	 *
	 * @return void
	 */
	public function maybe_render_notice() {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( 'manage_wooptions-pro' ) ) {
			return;
		}

		if ( self::is_active() ) {
			return;
		}

		$screen    = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$screen_id = $screen ? (string) $screen->id : '';
		$page      = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		// Only show on main WP dashboard (not inside WooOptions Pro pages where .wof-license-banner is rendered).
		if ( ! $screen || 'dashboard' !== $screen->id ) {
			return;
		}

		$message = LicenseGate::locked_message();

		printf(
			'<div class="notice notice-warning is-dismissible"><p><strong>%1$s</strong> %2$s <a class="button button-primary button-small" style="margin-left: 8px;" href="%3$s">%4$s</a></p></div>',
			esc_html__( 'WooOptions Pro:', 'wooptions-pro' ),
			esc_html( $message ),
			esc_url( admin_url( 'admin.php?page=wooptions-pro-license' ) ),
			esc_html__( 'Manage License', 'wooptions-pro' )
		);
	}
}

// Global class alias for backward compatibility.
if ( ! class_exists( 'WooOptionsPro_License', false ) ) {
	class_alias( LicenseManager::class, 'WooOptionsPro_License' );
}
