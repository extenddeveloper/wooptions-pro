<?php
/**
 * Elite Licenser application wrapper for WooOptions Pro.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License\Updater;

defined( 'ABSPATH' ) || exit;

/**
 * Higher-level licensing coordinator.
 */
class EliteLicensing {

	/** @var EliteLicensing|null */
	private static $instance = null;

	/** @var EliteLicenserBase|null */
	private $base = null;

	/** @var array<string,mixed> */
	private $config = array();

	/** @var string Stored option name. */
	private $settingsKey = 'wooptions_pro_elite_license'; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.PropertyNotSnakeCase

	/**
	 * Register client instance.
	 *
	 * @param array<string,mixed> $config Product configuration.
	 * @return EliteLicensing
	 */
	public function register( $config = array() ) {
		if ( self::$instance ) {
			return self::$instance;
		}

		$this->config = wp_parse_args(
			$config,
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

		$this->settingsKey = (string) $this->config['settings_key'];
		$this->base        = new EliteLicenserBase( $this->config );
		$this->base->on_remote_delete( array( $this, 'clear_stored_credentials' ) );

		add_action( 'admin_init', array( $this, 'maybe_sync_license' ) );

		self::$instance = $this;
		return self::$instance;
	}

	/**
	 * Access singleton instance.
	 *
	 * @return EliteLicensing
	 */
	public static function getInstance() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		return self::$instance ? self::$instance : new self();
	}

	/**
	 * Configuration reader.
	 *
	 * @param string $key Property.
	 * @return mixed
	 */
	public function getConfig( $key ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		return isset( $this->config[ $key ] ) ? $this->config[ $key ] : null;
	}

	/**
	 * Low-level client accessor.
	 *
	 * @return EliteLicenserBase|null
	 */
	public function getBase() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		return $this->base;
	}

	/**
	 * Activate a license key with an optional purchase email.
	 *
	 * @param string $license_key   Plain key.
	 * @param string $license_email Customer email.
	 * @return array<string,mixed>|\WP_Error
	 */
	public function activate( $license_key = '', $license_email = '' ) {
		$license_key   = sanitize_text_field( $license_key );
		$license_email = sanitize_email( $license_email );

		if ( '' === $license_key ) {
			return new \WP_Error( 'license_key_missing', __( 'License key is required for activation.', 'wooptions-pro' ) );
		}
		if ( '' !== $license_email && ! is_email( $license_email ) ) {
			return new \WP_Error( 'license_email_invalid', __( 'Enter a valid purchase email or leave the field empty.', 'wooptions-pro' ) );
		}
		if ( ! function_exists( 'openssl_encrypt' ) || ! function_exists( 'openssl_decrypt' ) ) {
			return new \WP_Error( 'openssl_missing', __( 'The PHP OpenSSL extension is required for secure license activation.', 'wooptions-pro' ) );
		}

		$message  = '';
		$response = null;
		$valid    = $this->base->check_license( $license_key, $license_email, $message, $response, true );

		if ( ! $valid || ! is_object( $response ) ) {
			return new \WP_Error(
				'wooptions_pro_elite_activation_failed',
				$message ? $message : __( 'License activation failed. Check the key and purchase email.', 'wooptions-pro' )
			);
		}

		$status = $this->normalize_response( $response, $license_key, $license_email );
		$this->save_state( $status, false );

		if ( class_exists( '\WooOptionsPro\License\LicenseGate' ) ) {
			\WooOptionsPro\License\LicenseGate::mark_activated();
		} elseif ( class_exists( 'WooOptionsPro_License_Gate' ) ) {
			\WooOptionsPro_License_Gate::mark_activated();
		}

		update_option( 'wooptions_pro_license_status', 'valid' === $status['status'], false );
		$this->base->clear_update_info();
		return $status;
	}

	/**
	 * Deactivate the current license.
	 *
	 * Always clears local state and caches regardless of remote outcome.
	 *
	 * @return array<string,mixed>
	 */
	public function deactivate() {
		$message = '';
		$this->base->deactivate( $message );

		$this->clear_stored_credentials();
		$state                   = $this->default_state();
		$state['status']         = 'deactivated';
		$state['message']        = $message ? $message : __( 'License deactivated.', 'wooptions-pro' );
		$state['ever_activated'] = true;
		$state['deactivated_at'] = time();

		update_option( $this->settingsKey, $state, false );

		if ( class_exists( '\WooOptionsPro\License\LicenseGate' ) ) {
			\WooOptionsPro\License\LicenseGate::mark_deactivated();
		} elseif ( class_exists( 'WooOptionsPro_License_Gate' ) ) {
			\WooOptionsPro_License_Gate::mark_deactivated();
		}

		update_option( 'wooptions_pro_license_status', false, false );

		return array(
			'status'  => 'deactivated',
			'message' => $message ? $message : __( 'License deactivated successfully.', 'wooptions-pro' ),
		);
	}

	/**
	 * Return normalized local status or force a remote validation.
	 *
	 * @param bool $remote_fetch Force a server check.
	 * @return array<string,mixed>
	 */
	public function getStatus( $remote_fetch = false ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		$state = $this->read_state();
		$key   = $this->decrypt_license_key(
			isset( $state['license_key'] ) ? (string) $state['license_key'] : '',
			isset( $state['license_email'] ) ? (string) $state['license_email'] : ''
		);
		$email = isset( $state['license_email'] ) ? sanitize_email( $state['license_email'] ) : '';

		// If license key is empty, status cannot be valid.
		if ( '' === $key && 'valid' === ( $state['status'] ?? '' ) ) {
			$state['status'] = 'unregistered';
		}

		if ( $remote_fetch && '' !== $key && empty( $state['migration_pending'] ) ) {
			$message  = '';
			$response = null;
			if ( ! $this->base->check_license( $key, $email, $message, $response, true ) ) {
				$failure_type           = $this->base->get_last_failure_type();
				$state['status']        = 'network' === $failure_type ? 'connection_error' : 'invalid';
				$state['failure_type']  = $failure_type;
				$state['message']       = $message;
				$state['checked_at']    = time();
				$state['next_retry_at'] = 'network' === $failure_type ? time() + ( 6 * ( defined( 'HOUR_IN_SECONDS' ) ? \HOUR_IN_SECONDS : 3600 ) ) : 0;
				$this->save_state( $state, true );
				update_option( 'wooptions_pro_license_status', false, false );
			} elseif ( is_object( $response ) ) {
				$failure_type = $this->base->get_last_failure_type();
				$state        = $this->normalize_response( $response, $key, $email, 'grace' === $failure_type );
				$this->save_state( $state, false );
				update_option( 'wooptions_pro_license_status', in_array( $state['status'], array( 'valid', 'grace' ), true ), false );
			}
		}

		return $this->public_state( $state );
	}

	/**
	 * Current decrypted license key.
	 *
	 * @return string
	 */
	public function getCurrentLicenseKey() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		$status = $this->getStatus( false );
		return is_array( $status ) && isset( $status['license_key'] ) ? (string) $status['license_key'] : '';
	}

	/**
	 * Current license email.
	 *
	 * @return string
	 */
	public function getCurrentLicenseEmail() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		$status = $this->getStatus( false );
		return is_array( $status ) && isset( $status['license_email'] ) ? (string) $status['license_email'] : '';
	}

	/**
	 * Clear the adapter's locally stored credentials and status.
	 *
	 * @return void
	 */
	public function clear_stored_credentials() {
		delete_option( $this->settingsKey );
	}

	/**
	 * Hooked to admin_init to sync if validation is due.
	 *
	 * @return void
	 */
	public function maybe_sync_license() {
		$this->sync_if_registered();
	}

	/**
	 * Validate a stored license when Elite's next-request time is due.
	 *
	 * @return void
	 */
	private function sync_if_registered() {
		$state = $this->read_state();
		if (
			empty( $state )
			|| ! empty( $state['migration_pending'] )
			|| ! in_array( (string) $state['status'], array( 'valid', 'grace', 'connection_error' ), true )
		) {
			return;
		}

		if ( 'connection_error' === (string) $state['status'] && ! empty( $state['next_retry_at'] ) && (int) $state['next_retry_at'] > time() ) {
			return;
		}

		$email = isset( $state['license_email'] ) ? sanitize_email( $state['license_email'] ) : '';
		$key   = $this->decrypt_license_key( isset( $state['license_key'] ) ? (string) $state['license_key'] : '', $email );
		if ( '' === $key ) {
			return;
		}

		if ( 'connection_error' !== (string) $state['status'] && ! $this->base->is_validation_due( $key, $email ) ) {
			return;
		}

		$message  = '';
		$response = null;
		$valid    = $this->base->check_license( $key, $email, $message, $response, false );

		if ( $valid && is_object( $response ) ) {
			$failure_type = $this->base->get_last_failure_type();
			$state        = $this->normalize_response( $response, $key, $email, 'grace' === $failure_type );
			$this->save_state( $state, false );
			update_option( 'wooptions_pro_license_status', in_array( $state['status'], array( 'valid', 'grace' ), true ), false );
			return;
		}

		$failure_type           = $this->base->get_last_failure_type();
		$state['status']        = 'network' === $failure_type ? 'connection_error' : 'invalid';
		$state['failure_type']  = $failure_type;
		$state['message']       = $message;
		$state['checked_at']    = time();
		$state['next_retry_at'] = 'network' === $failure_type ? time() + ( 6 * ( defined( 'HOUR_IN_SECONDS' ) ? \HOUR_IN_SECONDS : 3600 ) ) : 0;
		$this->save_state( $state, true );
		update_option( 'wooptions_pro_license_status', false, false );
	}

	/**
	 * Normalize Elite's response for the UI.
	 *
	 * @param object $response      Elite response.
	 * @param string $license_key   License key.
	 * @param string $license_email License email.
	 * @param bool   $is_grace      Grace state flag.
	 * @return array<string,mixed>
	 */
	private function normalize_response( $response, $license_key, $license_email, $is_grace = false ) {
		$expires    = isset( $response->expire_date ) ? trim( (string) $response->expire_date ) : '';
		$is_expired = $this->is_expired_date( $expires );
		$is_valid   = ! empty( $response->is_valid ) && ! $is_expired;
		$current    = $this->read_state();

		return array(
			'license_key'         => $this->encrypt_license_key( $license_key, $license_email ),
			'license_email'       => $license_email,
			'status'              => $is_valid ? ( $is_grace ? 'grace' : 'valid' ) : 'invalid',
			'license_title'       => isset( $response->license_title ) ? sanitize_text_field( $response->license_title ) : '',
			'expires'             => $this->normalize_date_label( $expires, 'lifetime' ),
			'support_expires'     => isset( $response->support_end ) ? sanitize_text_field( $response->support_end ) : '',
			'is_expired'          => $is_expired,
			'renewal_url'         => ! empty( $response->expire_renew_link ) ? esc_url_raw( $response->expire_renew_link ) : ( ! empty( $response->renew_link ) ? esc_url_raw( $response->renew_link ) : '' ),
			'support_renewal_url' => ! empty( $response->support_renew_link ) ? esc_url_raw( $response->support_renew_link ) : '',
			'message'             => isset( $response->msg ) ? sanitize_text_field( $response->msg ) : '',
			'migration_pending'   => false,
			'checked_at'          => time(),
			'ever_activated'      => true,
			'last_valid_at'       => $is_grace ? (int) ( $current['last_valid_at'] ?? time() ) : time(),
			'failure_type'        => $is_grace ? 'grace' : '',
			'deactivated_at'      => 0,
			'next_retry_at'       => 0,
		);
	}

	/**
	 * Default state.
	 *
	 * @return array<string,mixed>
	 */
	private function default_state() {
		return array(
			'license_key'         => '',
			'license_email'       => '',
			'status'              => 'unregistered',
			'license_title'       => '',
			'expires'             => '',
			'support_expires'     => '',
			'is_expired'          => false,
			'renewal_url'         => '',
			'support_renewal_url' => '',
			'message'             => '',
			'migration_pending'   => false,
			'checked_at'          => 0,
			'ever_activated'      => false,
			'last_valid_at'       => 0,
			'failure_type'        => '',
			'deactivated_at'      => 0,
			'next_retry_at'       => 0,
		);
	}

	/**
	 * Read stored state.
	 *
	 * @return array<string,mixed>
	 */
	private function read_state() {
		$state = get_option( $this->settingsKey, array() );
		return is_array( $state ) ? wp_parse_args( $state, $this->default_state() ) : $this->default_state();
	}

	/**
	 * Save state while retaining or replacing its encrypted key.
	 *
	 * @param array<string,mixed> $state                  State.
	 * @param bool                $key_already_encrypted Whether license_key is already encrypted.
	 * @return void
	 */
	private function save_state( $state, $key_already_encrypted ) {
		$current = $this->read_state();
		$state   = wp_parse_args( $state, $current );

		if ( ! $key_already_encrypted && ! empty( $state['license_key'] ) && 0 !== strpos( (string) $state['license_key'], 'v1:' ) ) {
			$state['license_key'] = $this->encrypt_license_key( (string) $state['license_key'], (string) $state['license_email'] );
		}

		update_option( $this->settingsKey, $state, false );
	}

	/**
	 * Convert stored encrypted state into UI-safe public state.
	 *
	 * @param array<string,mixed> $state Stored state.
	 * @return array<string,mixed>
	 */
	private function public_state( $state ) {
		$state['license_key'] = $this->decrypt_license_key(
			isset( $state['license_key'] ) ? (string) $state['license_key'] : '',
			isset( $state['license_email'] ) ? (string) $state['license_email'] : ''
		);
		return $state;
	}

	/**
	 * Encrypt the local key with WordPress salts and an authenticated MAC.
	 *
	 * @param string $plain_key Key.
	 * @param string $email     Email.
	 * @return string
	 */
	private function encrypt_license_key( $plain_key, $email ) {
		if ( '' === $plain_key ) {
			return '';
		}

		$secret = $this->license_storage_key( $email );
		$iv     = substr( hash( 'sha256', 'iv:' . $secret ), 0, 16 );
		$cipher = openssl_encrypt( $plain_key, 'aes-256-cbc', substr( $secret, 0, 32 ), OPENSSL_RAW_DATA, $iv );

		if ( false === $cipher ) {
			return $plain_key;
		}

		$mac = hash_hmac( 'sha256', $cipher, $secret );
		return 'v1:' . base64_encode( $cipher ) . ':' . $mac;
	}

	/**
	 * Decrypt a stored key.
	 *
	 * @param string $stored Stored string.
	 * @param string $email  Email.
	 * @return string
	 */
	private function decrypt_license_key( $stored, $email ) {
		if ( '' === $stored || 0 !== strpos( $stored, 'v1:' ) ) {
			return $stored;
		}

		$parts = explode( ':', $stored );
		if ( 3 !== count( $parts ) ) {
			return '';
		}

		$cipher = base64_decode( $parts[1], true );
		if ( false === $cipher ) {
			return '';
		}

		$secret = $this->license_storage_key( $email );
		$mac    = hash_hmac( 'sha256', $cipher, $secret );
		if ( ! hash_equals( $mac, (string) $parts[2] ) ) {
			return '';
		}

		$iv        = substr( hash( 'sha256', 'iv:' . $secret ), 0, 16 );
		$plaintext = openssl_decrypt( $cipher, 'aes-256-cbc', substr( $secret, 0, 32 ), OPENSSL_RAW_DATA, $iv );
		return false === $plaintext ? '' : (string) $plaintext;
	}

	/**
	 * Derive local encryption key from site salts.
	 *
	 * @param string $email Email.
	 * @return string
	 */
	private function license_storage_key( $email ) {
		$salt = defined( 'LOGGED_IN_SALT' ) ? LOGGED_IN_SALT : ( defined( 'AUTH_SALT' ) ? AUTH_SALT : 'wooptions_pro_salt' );
		return hash( 'sha256', $salt . '|' . $this->config['product_id'] . '|' . strtolower( trim( (string) $email ) ) );
	}

	/**
	 * Normalize date label for the UI.
	 *
	 * @param string $value   Raw date.
	 * @param string $default Default label.
	 * @return string
	 */
	private function normalize_date_label( $value, $default = 'lifetime' ) {
		$clean = strtolower( trim( (string) $value ) );
		if ( '' === $clean || 'no expiry' === $clean || 'no support' === $clean || 'unlimited' === $clean ) {
			return $default;
		}
		return (string) $value;
	}

	/**
	 * Determine if an expiry string is expired.
	 *
	 * @param string $value Date.
	 * @return bool
	 */
	private function is_expired_date( $value ) {
		$clean = strtolower( trim( (string) $value ) );
		if ( '' === $clean || in_array( $clean, array( 'no expiry', 'lifetime', 'unlimited' ), true ) ) {
			return false;
		}
		$ts = strtotime( (string) $value );
		return false !== $ts && $ts < current_time( 'timestamp', true );
	}
}
