<?php
/**
 * Central WooOptions Pro license policy and feature gate.
 *
 * Keeps navigation, administrative writes, saved storefront behaviour, and
 * update eligibility separate so a license outage never has to break a live store.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License;

defined( 'ABSPATH' ) || exit;

/**
 * License policy and feature gate.
 */
final class LicenseGate {

	const HISTORY_OPTION = 'wooptions_pro_license_history';

	const STATE_UNLICENSED       = 'unlicensed';
	const STATE_ACTIVE           = 'active';
	const STATE_GRACE            = 'grace';
	const STATE_EXPIRED          = 'expired';
	const STATE_CONNECTION_ERROR = 'connection_error';
	const STATE_INVALID          = 'invalid';
	const STATE_DEACTIVATED      = 'deactivated';

	/** @var array<string,mixed>|null */
	private static $state_cache = null;

	/**
	 * Reset the in-request state cache after activation/deactivation.
	 *
	 * @return void
	 */
	public static function reset_cache() {
		self::$state_cache = null;
	}

	/**
	 * Record a successful activation/validation.
	 *
	 * @return void
	 */
	public static function mark_activated() {
		$history                   = self::history();
		$history['ever_activated'] = true;
		$history['last_valid_at']  = time();
		$history['deactivated_at'] = 0;
		update_option( self::HISTORY_OPTION, $history, false );
		self::reset_cache();
	}

	/**
	 * Record an explicit customer-requested deactivation.
	 *
	 * @return void
	 */
	public static function mark_deactivated() {
		$history                   = self::history();
		$history['deactivated_at'] = time();
		update_option( self::HISTORY_OPTION, $history, false );
		self::reset_cache();
	}

	/**
	 * Return normalized license state and history.
	 *
	 * @return array<string,mixed>
	 */
	public static function state_data() {
		if ( null !== self::$state_cache ) {
			return self::$state_cache;
		}

		if ( defined( 'WOOPTIONS_PRO_LICENSE_FORCE_ACTIVE' ) && WOOPTIONS_PRO_LICENSE_FORCE_ACTIVE ) {
			self::$state_cache = array(
				'state'          => self::STATE_ACTIVE,
				'ever_activated' => true,
				'message'        => '',
				'raw'            => array(),
			);
			return self::$state_cache;
		}

		$raw     = get_option( 'wooptions_pro_elite_license', array() );
		$raw     = is_array( $raw ) ? $raw : array();
		$history = self::history();
		$status  = isset( $raw['status'] ) ? sanitize_key( (string) $raw['status'] ) : 'unregistered';
		$state   = self::STATE_UNLICENSED;
		$expires = isset( $raw['expires'] ) ? (string) $raw['expires'] : '';

		if ( ! empty( $raw['is_expired'] ) || self::is_expired_label( $expires ) ) {
			$state = self::STATE_EXPIRED;
		} elseif ( 'valid' === $status ) {
			$state = self::STATE_ACTIVE;
		} elseif ( 'grace' === $status ) {
			$state = self::STATE_GRACE;
		} elseif ( 'connection_error' === $status ) {
			$state = self::STATE_CONNECTION_ERROR;
		} elseif ( 'deactivated' === $status ) {
			$state = self::STATE_DEACTIVATED;
		} elseif ( in_array( $status, array( 'invalid', 'revoked', 'blocked' ), true ) ) {
			$state = self::STATE_INVALID;
		}

		// A license is unlicensed if key is absent or migration is pending (unless explicitly deactivated).
		if ( ! empty( $raw['migration_pending'] ) || ( empty( $raw['license_key'] ) && 'deactivated' !== $status ) ) {
			$state = self::STATE_UNLICENSED;
		}

		self::$state_cache = array(
			'state'          => $state,
			'ever_activated' => ! empty( $history['ever_activated'] ) || ! empty( $raw['ever_activated'] ),
			'last_valid_at'  => max( (int) ( $history['last_valid_at'] ?? 0 ), (int) ( $raw['last_valid_at'] ?? 0 ) ),
			'deactivated_at' => max( (int) ( $history['deactivated_at'] ?? 0 ), (int) ( $raw['deactivated_at'] ?? 0 ) ),
			'message'        => isset( $raw['message'] ) ? sanitize_text_field( (string) $raw['message'] ) : '',
			'raw'            => $raw,
		);

		return self::$state_cache;
	}

	/**
	 * Current normalized state name.
	 *
	 * @return string
	 */
	public static function state() {
		$data = self::state_data();
		return (string) $data['state'];
	}

	/**
	 * Whether administrators may open and edit premium configuration.
	 *
	 * @return bool
	 */
	public static function can_configure() {
		$data = self::state_data();
		$key  = ! empty( $data['raw']['license_key'] );
		return $key && in_array( $data['state'], array( self::STATE_ACTIVE, self::STATE_GRACE ), true );
	}

	/**
	 * Whether already-saved customer-facing configuration may keep running.
	 *
	 * @return bool
	 */
	public static function can_run_saved_configuration() {
		$data  = self::state_data();
		$state = (string) $data['state'];

		if ( in_array( $state, array( self::STATE_ACTIVE, self::STATE_GRACE ), true ) ) {
			return true;
		}

		return ! empty( $data['ever_activated'] )
			&& in_array( $state, array( self::STATE_EXPIRED, self::STATE_CONNECTION_ERROR ), true );
	}

	/**
	 * Whether protected update packages may be delivered.
	 *
	 * @return bool
	 */
	public static function can_receive_updates() {
		return self::STATE_ACTIVE === self::state() || self::STATE_GRACE === self::state();
	}

	/**
	 * Stop a mutation when configuration is locked.
	 *
	 * @param bool $ajax Return WP_Error or JSON error instead of redirecting.
	 * @return \WP_Error|void
	 */
	public static function require_configuration( $ajax = false ) {
		if ( self::can_configure() ) {
			return null;
		}

		$message = self::locked_message();
		if ( empty( $message ) ) {
			$message = __( 'Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro' );
		}

		if ( $ajax ) {
			return new \WP_Error(
				'wooptions_pro_license_required',
				$message,
				array( 'status' => 403 )
			);
		}

		$fallback = admin_url( 'admin.php?page=wooptions-pro-license' );
		wp_safe_redirect( $fallback );
		exit;
	}

	/**
	 * User-facing lock message for the current state.
	 *
	 * @return string
	 */
	public static function locked_message() {
		switch ( self::state() ) {
			case self::STATE_EXPIRED:
				return __( 'Your WooOptions Pro license has expired. Renew it to create and edit option sets.', 'wooptions-pro' );
			case self::STATE_CONNECTION_ERROR:
				return __( 'WooOptions Pro could not reach the license server. Saved storefront options remain active, but editing is temporarily paused.', 'wooptions-pro' );
			case self::STATE_DEACTIVATED:
				return __( 'The WooOptions Pro license is deactivated. Activate a license to continue.', 'wooptions-pro' );
			case self::STATE_INVALID:
				return __( 'The WooOptions Pro license is not valid for this website. Activate a valid license to continue.', 'wooptions-pro' );
			default:
				return __( 'Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro' );
		}
	}

	/**
	 * Feature presentation details for blocking overlay modals.
	 *
	 * @param string $feature Feature identifier.
	 * @return array<string,mixed>
	 */
	public static function feature( $feature ) {
		$features = array(
			'option-sets' => array(
				'title'       => __( 'Option Sets', 'wooptions-pro' ),
				'description' => __( 'Create and organize custom option sets for your WooCommerce catalog.', 'wooptions-pro' ),
			),
			'builder' => array(
				'title'       => __( 'Precision Option Builder', 'wooptions-pro' ),
				'description' => __( 'Design custom fields, dynamic pricing formulas, conditional logic, and live previews.', 'wooptions-pro' ),
			),
			'templates' => array(
				'title'       => __( 'Templates Library', 'wooptions-pro' ),
				'description' => __( 'Import and reuse standard option templates across products and categories.', 'wooptions-pro' ),
			),
			'analytics' => array(
				'title'       => __( 'Option Analytics', 'wooptions-pro' ),
				'description' => __( 'Review option selection metrics, add-on revenue, and configuration trends.', 'wooptions-pro' ),
			),
			'settings' => array(
				'title'       => __( 'WooOptions Pro Settings', 'wooptions-pro' ),
				'description' => __( 'Configure typography catalogs, custom fonts, color palettes, and builder controls.', 'wooptions-pro' ),
			),
		);

		return isset( $features[ $feature ] ) ? $features[ $feature ] : array(
			'title'       => __( 'WooOptions Pro', 'wooptions-pro' ),
			'description' => __( 'Activate your license to unlock all premium features.', 'wooptions-pro' ),
		);
	}

	/**
	 * Determine whether a stored Elite expiry label is in the past.
	 *
	 * @param string $value Expiry date or lifetime label.
	 * @return bool
	 */
	private static function is_expired_label( $value ) {
		$normalized = strtolower( trim( (string) $value ) );
		if ( '' === $normalized || in_array( $normalized, array( 'lifetime', 'unlimited', 'no expiry', 'no support' ), true ) ) {
			return false;
		}

		$timestamp = strtotime( (string) $value );
		return false !== $timestamp && $timestamp < current_time( 'timestamp', true );
	}

	/**
	 * Read normalized history defaults.
	 *
	 * @return array<string,mixed>
	 */
	private static function history() {
		$history = get_option( self::HISTORY_OPTION, array() );
		$history = is_array( $history ) ? $history : array();
		return wp_parse_args(
			$history,
			array(
				'ever_activated' => false,
				'last_valid_at'  => 0,
				'deactivated_at' => 0,
			)
		);
	}
}

// Global class alias for backward compatibility.
if ( ! class_exists( 'WooOptionsPro_License_Gate', false ) ) {
	class_alias( LicenseGate::class, 'WooOptionsPro_License_Gate' );
}
