<?php
/**
 * Elite Licenser protocol client and WordPress updater.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License\Updater;

defined( 'ABSPATH' ) || exit;

/**
 * Low-level Elite Licenser client for WooOptions Pro.
 */
class EliteLicenserBase {

	/** Keep a previously valid installation operational during temporary outages. */
	const CONNECTION_GRACE_SECONDS = 259200; // 72 hours.

	/** @var array<string,mixed> */
	private $config = array();

	/** @var string */
	private $response_option = '';

	/** @var string */
	private $update_cache_key = '';

	/** @var callable[] */
	private $delete_callbacks = array();

	/** @var string Last activation/check outcome category. */
	private $last_failure_type = '';

	/**
	 * Constructor.
	 *
	 * @param array<string,mixed> $config Product and plugin configuration.
	 */
	public function __construct( $config ) {
		$defaults = array(
			'request_key'  => '0788A6B548D50039',
			'product_id'   => '13',
			'product_base' => 'woooptions-pro',
			'server_url'   => 'https://license.themefic.com/wp-json/licensor/',
			'plugin_file'  => defined( 'WOOPTIONS_PRO_FILE' ) ? WOOPTIONS_PRO_FILE : '',
			'basename'     => defined( 'WOOPTIONS_PRO_BASENAME' ) ? WOOPTIONS_PRO_BASENAME : '',
			'version'      => defined( 'WOOPTIONS_PRO_VERSION' ) ? WOOPTIONS_PRO_VERSION : '1.0.0',
			'slug'         => 'wooptions-pro',
		);

		$this->config = wp_parse_args( $config, $defaults );

		$this->response_option = 'wooptions_pro_elite_response_' . hash(
			'crc32b',
			$this->get_domain()
			. (string) $this->config['basename']
			. (string) $this->config['product_id']
			. (string) $this->config['product_base']
			. (string) $this->config['request_key']
			. 'LIC'
		);
		$this->update_cache_key = 'wooptions_pro_elite_update_' . md5(
			(string) $this->config['product_base'] . ':' . (string) $this->config['product_id']
		);

		$this->register_wordpress_hooks();
	}

	/**
	 * Register a callback that clears higher-level stored credentials.
	 *
	 * @param callable $callback Callback.
	 * @return void
	 */
	public function add_on_delete( $callback ) {
		if ( is_callable( $callback ) ) {
			$this->delete_callbacks[] = $callback;
		}
	}

	/**
	 * Backward compatibility alias for add_on_delete.
	 *
	 * @param callable $callback Callback.
	 * @return void
	 */
	public function on_remote_delete( $callback ) {
		$this->add_on_delete( $callback );
	}

	/**
	 * Return the last check outcome category.
	 *
	 * Values are empty for a successful remote validation, `grace` when a
	 * cached license is being used during a temporary outage, `network` when no
	 * grace remains, and `invalid` for an explicit server rejection.
	 *
	 * @return string
	 */
	public function get_last_failure_type() {
		return $this->last_failure_type;
	}

	/**
	 * Configuration accessor.
	 *
	 * @param string $key Config key.
	 * @return mixed
	 */
	public function get_config( $key ) {
		return isset( $this->config[ $key ] ) ? $this->config[ $key ] : null;
	}

	/**
	 * Determine whether the locally scheduled Elite validation is due.
	 *
	 * This lets the adapter avoid rewriting its normalized option on every
	 * WordPress request while the generated client's cached response is valid.
	 *
	 * @param string $license_key License key.
	 * @param string $email       License email.
	 * @return bool
	 */
	public function is_validation_due( $license_key, $email = '' ) {
		return ! $this->is_cached_response_usable(
			$this->get_local_response(),
			trim( (string) $license_key ),
			sanitize_email( (string) $email )
		);
	}

	/**
	 * Check or activate a license, respecting Elite's request schedule.
	 *
	 * @param string      $license_key  License key.
	 * @param string      $email        License email.
	 * @param string      $message      Response message.
	 * @param object|null $response_obj Normalized response object.
	 * @param bool        $force        Bypass the locally scheduled check time.
	 * @return bool
	 */
	public function check_license( $license_key, $email, &$message = '', &$response_obj = null, $force = false ) {
		$this->last_failure_type = '';
		$license_key = trim( (string) $license_key );
		$email       = sanitize_email( (string) $email );

		if ( '' === $license_key ) {
			$this->last_failure_type = 'unregistered';
			$this->remove_local_response( false );
			$message = '';
			return false;
		}

		$old_response = $this->get_local_response();

		if (
			! $force
			&& $this->is_cached_response_usable( $old_response, $license_key, $email )
		) {
			$response_obj = $this->public_response( $old_response );
			$message      = isset( $response_obj->msg ) ? (string) $response_obj->msg : '';
			return true;
		}

		$payload  = $this->get_request_payload( $license_key, $email );
		$response = $this->request( 'product/active/' . rawurlencode( (string) $this->config['product_id'] ), $payload );

		if ( ! empty( $response->is_request_error ) ) {
			$message = ! empty( $response->msg ) ? (string) $response->msg : __( 'Unable to connect to the license server.', 'wooptions-pro' );
			$grace   = $this->use_temporary_grace( $old_response, $response_obj );
			$this->last_failure_type = $grace ? 'grace' : 'network';
			return $grace;
		}

		if ( ! empty( $response->code ) ) {
			$this->last_failure_type = 'invalid';
			$message = ! empty( $response->message ) ? (string) $response->message : __( 'The license server returned an error.', 'wooptions-pro' );
			$this->remove_local_response( false );
			return false;
		}

		if ( empty( $response->status ) ) {
			$this->last_failure_type = 'invalid';
			$message = ! empty( $response->msg ) ? (string) $response->msg : __( 'License activation failed.', 'wooptions-pro' );
			if ( false !== stripos( $message, 'request param is invalid' ) ) {
				$message .= ' ' . sprintf(
					/* translators: 1: Elite product ID, 2: product base. */
					__( 'The installed Elite client is configured for product %1$s and base %2$s. Verify that the license was issued for this generated product configuration.', 'wooptions-pro' ),
					(string) $this->config['product_id'],
					(string) $this->config['product_base']
				);
			}
			$this->remove_local_response( false );
			return false;
		}

		if ( empty( $response->data ) ) {
			$this->last_failure_type = 'invalid';
			$message = __( 'The license server returned incomplete data.', 'wooptions-pro' );
			$this->remove_local_response( false );
			return false;
		}

		$serialized = $this->decrypt( (string) $response->data, (string) $payload->domain );
		$license    = $this->safe_unserialize_object( $serialized );

		if ( ! is_object( $license ) || empty( $license->is_valid ) ) {
			$this->last_failure_type = 'invalid';
			$message = ! empty( $response->msg ) ? (string) $response->msg : __( 'The license is not valid for this website.', 'wooptions-pro' );
			$this->remove_local_response( false );
			return false;
		}

		$request_hours = isset( $license->request_duration ) ? (int) $license->request_duration : 0;
		$request_hours = max( 1, $request_hours );
		$hour_sec      = defined( 'HOUR_IN_SECONDS' ) ? \HOUR_IN_SECONDS : 3600;

		$stored                     = new \stdClass();
		$stored->is_valid           = true;
		$stored->validated_at       = time();
		$stored->next_request       = time() + ( $request_hours * $hour_sec );
		$stored->expire_date        = isset( $license->expire_date ) ? (string) $license->expire_date : '';
		$stored->support_end        = isset( $license->support_end ) ? (string) $license->support_end : '';
		$stored->license_title      = isset( $license->license_title ) ? (string) $license->license_title : '';
		$stored->license_key        = $license_key;
		$stored->license_email      = $email;
		$stored->msg                = ! empty( $response->msg ) ? (string) $response->msg : __( 'License activated successfully.', 'wooptions-pro' );
		$stored->renew_link         = isset( $license->renew_link ) ? (string) $license->renew_link : '';
		$stored->expire_renew_link  = $this->get_renew_link( $stored, 'l' );
		$stored->support_renew_link = $this->get_renew_link( $stored, 's' );
		$stored->tried              = 0;

		$this->save_local_response( $stored );
		$this->clear_update_info();

		$response_obj = $this->public_response( $stored );
		$message      = $stored->msg;
		$this->last_failure_type = '';
		return true;
	}

	/**
	 * Deactivate the currently registered domain.
	 *
	 * @param string $message Response message.
	 * @return bool
	 */
	public function deactivate( &$message = '' ) {
		$stored = $this->get_local_response();

		if ( ! is_object( $stored ) || empty( $stored->license_key ) ) {
			$this->remove_local_response( true );
			$this->clear_update_info();
			$message = __( 'License deactivated.', 'wooptions-pro' );
			return true;
		}

		$payload  = $this->get_request_payload(
			(string) $stored->license_key,
			isset( $stored->license_email ) ? (string) $stored->license_email : ''
		);
		$response = $this->request( 'product/deactive/' . rawurlencode( (string) $this->config['product_id'] ), $payload );

		$this->remove_local_response( true );
		$this->clear_update_info();

		if ( ! empty( $response->is_request_error ) ) {
			$message = ! empty( $response->msg ) ? (string) $response->msg : __( 'License deactivated locally (license server was unreachable).', 'wooptions-pro' );
			return true;
		}

		if ( empty( $response->status ) ) {
			$message = ! empty( $response->msg ) ? (string) $response->msg : __( 'License deactivated locally.', 'wooptions-pro' );
			return true;
		}

		$message = ! empty( $response->msg ) ? (string) $response->msg : __( 'License deactivated successfully.', 'wooptions-pro' );
		return true;
	}

	/**
	 * Return the cached Elite response without internal scheduling fields.
	 *
	 * @return object|null
	 */
	public function get_register_info() {
		$stored = $this->get_local_response();
		return is_object( $stored ) ? $this->public_response( $stored ) : null;
	}

	/**
	 * Clear only the locally cached response.
	 *
	 * @param bool $run_callbacks Whether to clear higher-level credentials too.
	 * @return void
	 */
	public function clear_local_response( $run_callbacks = false ) {
		delete_option( $this->response_option );
		if ( $run_callbacks ) {
			foreach ( $this->delete_callbacks as $callback ) {
				call_user_func( $callback );
			}
		}
	}

	/**
	 * Alias for clear_local_response.
	 *
	 * @param bool $run_callbacks Whether to clear higher-level credentials too.
	 * @return void
	 */
	public function remove_local_response( $run_callbacks = true ) {
		$this->clear_local_response( $run_callbacks );
	}

	/**
	 * Flush the plugin update cache.
	 *
	 * @return void
	 */
	public function clear_update_info() {
		delete_site_transient( 'update_plugins' );
		delete_site_transient( $this->update_cache_key );
	}

	/**
	 * Register WordPress updater and remote-cache hooks.
	 *
	 * @return void
	 */
	private function register_wordpress_hooks() {
		add_action( 'admin_post_wooptions_pro_elite_update_check', array( $this, 'handle_manual_update_check' ) );
		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'filter_plugin_updates' ) );
		add_filter( 'plugins_api', array( $this, 'filter_plugin_information' ), 10, 3 );
		add_filter( 'plugin_row_meta', array( $this, 'filter_plugin_row_meta' ), 10, 2 );
		add_action( 'in_plugin_update_message-' . (string) $this->config['basename'], array( $this, 'render_update_message' ), 20, 2 );
		add_action( 'upgrader_process_complete', array( $this, 'after_upgrade' ), 10, 2 );
		add_action( 'init', array( $this, 'register_server_listeners' ) );
	}

	/**
	 * Secure manual update-check action.
	 *
	 * @return void
	 */
	public function handle_manual_update_check() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_die( esc_html__( 'You do not have permission to check plugin updates.', 'wooptions-pro' ) );
		}

		check_admin_referer( 'wooptions_pro_elite_update_check' );
		$this->clear_update_info();
		wp_safe_redirect( admin_url( 'plugins.php' ) );
		exit;
	}

	/**
	 * Add a secure Check for updates link to the plugin row.
	 *
	 * @param string[] $links       Existing links.
	 * @param string   $plugin_file Plugin basename.
	 * @return string[]
	 */
	public function filter_plugin_row_meta( $links, $plugin_file ) {
		if ( (string) $this->config['basename'] !== $plugin_file || ! current_user_can( 'update_plugins' ) ) {
			return $links;
		}

		$url = wp_nonce_url(
			admin_url( 'admin-post.php?action=wooptions_pro_elite_update_check' ),
			'wooptions_pro_elite_update_check'
		);
		$links[] = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Check for updates', 'wooptions-pro' ) . '</a>';
		return $links;
	}

	/**
	 * Inject update data into WordPress's plugin update transient.
	 *
	 * @param object $transient Update transient.
	 * @return object
	 */
	public function filter_plugin_updates( $transient ) {
		if ( ! is_object( $transient ) ) {
			$transient = new \stdClass();
		}
		if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
			$transient->response = array();
		}
		if ( ! isset( $transient->no_update ) || ! is_array( $transient->no_update ) ) {
			$transient->no_update = array();
		}

		$update = $this->get_update_info();
		if ( ! is_object( $update ) || empty( $update->new_version ) ) {
			return $transient;
		}

		$basename = (string) $this->config['basename'];
		if ( version_compare( (string) $this->config['version'], (string) $update->new_version, '<' ) ) {
			$transient->response[ $basename ] = $update;
		} else {
			$transient->no_update[ $basename ] = $update;
		}

		$transient->checked[ $basename ] = (string) $this->config['version'];
		$transient->last_checked         = time();
		return $transient;
	}

	/**
	 * Backward compatibility filter for update transient.
	 *
	 * @param object $transient Transient.
	 * @return object
	 */
	public function filter_update_plugins( $transient ) {
		return $this->filter_plugin_updates( $transient );
	}

	/**
	 * Supply data to the WordPress plugin details modal.
	 *
	 * @param mixed  $result Existing result.
	 * @param string $action API action.
	 * @param object $args   Request arguments.
	 * @return mixed
	 */
	public function filter_plugin_information( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || ! is_object( $args ) || empty( $args->slug ) ) {
			return $result;
		}

		$allowed_slugs = array(
			(string) $this->config['slug'],
			(string) $this->config['product_base'],
			(string) $this->config['basename'],
		);
		if ( ! in_array( (string) $args->slug, $allowed_slugs, true ) ) {
			return $result;
		}

		$update = $this->get_update_info();
		return $update ? $update : $result;
	}

	/**
	 * Backward compatibility filter for plugin information modal.
	 *
	 * @param mixed  $result Existing result.
	 * @param string $action API action.
	 * @param object $args   Request arguments.
	 * @return mixed
	 */
	public function filter_plugins_api( $result, $action, $args ) {
		return $this->filter_plugin_information( $result, $action, $args );
	}

	/**
	 * Explain why an available package cannot be downloaded.
	 *
	 * @param array|object $data     Update data.
	 * @param object       $response Plugin response.
	 * @return void
	 */
	public function render_update_message( $data, $response ) {
		$data = is_array( $data ) ? (object) $data : $data;
		if ( ! is_object( $data ) || ! isset( $data->package ) || '' !== (string) $data->package ) {
			return;
		}

		$type = isset( $data->update_denied_type ) ? (string) $data->update_denied_type : '';
		if ( 'L' === $type ) {
			$message = __( 'Activate WooOptions Pro to download this update.', 'wooptions-pro' );
		} elseif ( 'S' === $type ) {
			$message = __( 'Renew your support period to download this update.', 'wooptions-pro' );
		} else {
			$message = __( 'Activate WooOptions Pro or renew your license/support period to download this update.', 'wooptions-pro' );
		}

		echo '<br><span style="display:block;border-top:1px solid #ccc;padding-top:6px;margin-top:10px;">' . esc_html( $message ) . '</span>';
	}

	/**
	 * Clear cached update information after any upgrader completes.
	 *
	 * @param object $upgrader Upgrader instance.
	 * @param array  $options  Upgrade options.
	 * @return void
	 */
	public function after_upgrade( $upgrader, $options ) {
		if ( ! is_array( $options ) || 'plugin' !== ( $options['type'] ?? '' ) ) {
			return;
		}

		$plugins = isset( $options['plugins'] ) && is_array( $options['plugins'] )
			? $options['plugins']
			: array();
		if ( isset( $options['plugin'] ) && is_string( $options['plugin'] ) ) {
			$plugins[] = $options['plugin'];
		}

		if ( in_array( (string) $this->config['basename'], $plugins, true ) ) {
			$this->clear_update_info();
		}
	}

	/**
	 * Register Elite's incoming webhook handler.
	 *
	 * @return void
	 */
	public function register_server_listeners() {
		$expected = hash( 'crc32b', (string) $this->config['product_id'] . (string) $this->config['request_key'] . $this->get_domain() ) . '_handle';
		$action   = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( $_GET['action'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( '' === $action || ! hash_equals( $expected, $action ) ) {
			return;
		}

		$type = isset( $_GET['type'] ) ? sanitize_key( wp_unslash( $_GET['type'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$this->handle_server_request( $type );
		exit;
	}

	/**
	 * Handle server webhook call.
	 *
	 * @param string $type Action type.
	 * @return void
	 */
	private function handle_server_request( $type ) {
		switch ( strtolower( trim( $type ) ) ) {
			case 'rl':
			case 'dl':
				$this->remove_local_response( true );
				$this->clear_update_info();
				$out          = new \stdClass();
				$out->product = (string) $this->config['product_id'];
				$out->status  = true;
				header( 'Content-Type: text/plain; charset=utf-8' );
				echo esc_html( $this->encrypt( serialize( $out ) ) );
				return;
			default:
				status_header( 400 );
				echo 'Unknown request';
				return;
		}
	}

	/**
	 * Fetch and normalize update information from Elite Licenser.
	 *
	 * @param bool $force_check Force remote fetch bypassing transient cache.
	 * @return object|null
	 */
	public function get_update_info( $force_check = false ) {
		if ( class_exists( '\\WooOptionsPro\\License\\LicenseGate' ) && ! \WooOptionsPro\License\LicenseGate::can_receive_updates() ) {
			return null;
		}

		$cached_body = ! $force_check ? get_site_transient( $this->update_cache_key ) : false;
		$body        = '';

		if ( is_string( $cached_body ) && '' !== $cached_body ) {
			$body = $this->decrypt( $cached_body );
		}

		if ( '' === $body ) {
			$registered = $this->get_local_response();
			$url        = trailingslashit( (string) $this->config['server_url'] )
				. 'product/update/' . rawurlencode( (string) $this->config['product_id'] );

			if ( is_object( $registered ) && ! empty( $registered->license_key ) ) {
				$url .= '/' . rawurlencode( (string) $registered->license_key )
					. '/' . rawurlencode( (string) $this->config['version'] );
			}

			$response = wp_remote_get(
				$url,
				array(
					'sslverify'   => true,
					'timeout'     => 20,
					'redirection' => 3,
					'cookies'     => array(),
				)
			);

			if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
				return null;
			}

			$body = (string) wp_remote_retrieve_body( $response );
			if ( '' === $body ) {
				return null;
			}
			$day_sec = defined( 'DAY_IN_SECONDS' ) ? \DAY_IN_SECONDS : 86400;
			set_site_transient( $this->update_cache_key, $this->encrypt( $body ), $day_sec );
		}

		$decoded = json_decode( $body );
		if ( ! is_object( $decoded ) || ! isset( $decoded->status ) ) {
			$decoded = json_decode( $this->decrypt( $body ) );
		}

		if ( ! is_object( $decoded ) || empty( $decoded->status ) || empty( $decoded->data ) || empty( $decoded->data->new_version ) ) {
			return null;
		}

		$data                     = $decoded->data;
		$data->slug               = (string) $this->config['slug'];
		$data->plugin             = (string) $this->config['basename'];
		$data->new_version        = (string) $data->new_version;
		$data->url                = ! empty( $data->url ) ? (string) $data->url : '';
		$data->package            = ! empty( $data->download_link ) ? (string) $data->download_link : '';
		$data->update_denied_type = ! empty( $data->update_denied_type ) ? (string) $data->update_denied_type : '';
		$data->sections           = isset( $data->sections ) ? (array) $data->sections : array();
		$data->icons              = isset( $data->icons ) ? (array) $data->icons : array();
		$data->banners            = isset( $data->banners ) ? (array) $data->banners : array();
		$data->banners_rtl        = isset( $data->banners_rtl ) ? (array) $data->banners_rtl : array();
		unset( $data->download_link, $data->is_stopped_update );
		return $data;
	}

	/**
	 * Determine whether a cached license response can be used.
	 *
	 * @param object|null $response    Cached response.
	 * @param string      $license_key License key.
	 * @param string      $email       License email.
	 * @return bool
	 */
	private function is_cached_response_usable( $response, $license_key, $email ) {
		if ( ! is_object( $response ) || empty( $response->is_valid ) || empty( $response->next_request ) ) {
			return false;
		}
		if ( (string) $response->license_key !== $license_key ) {
			return false;
		}
		if ( isset( $response->license_email ) && (string) $response->license_email !== $email ) {
			return false;
		}
		if ( $this->is_expired( isset( $response->expire_date ) ? (string) $response->expire_date : '' ) ) {
			return false;
		}
		return (int) $response->next_request > time();
	}

	/**
	 * Use a short, bounded grace window when the license server is unavailable.
	 *
	 * @param object|null $old_response Cached response.
	 * @param object|null $response_obj Public response.
	 * @return bool
	 */
	private function use_temporary_grace( $old_response, &$response_obj ) {
		if ( ! is_object( $old_response ) || empty( $old_response->is_valid ) || $this->is_expired( isset( $old_response->expire_date ) ? (string) $old_response->expire_date : '' ) ) {
			return false;
		}

		$validated_at = isset( $old_response->validated_at ) ? (int) $old_response->validated_at : time();
		if ( $validated_at <= 0 || time() - $validated_at > self::CONNECTION_GRACE_SECONDS ) {
			return false;
		}

		$hour_sec                   = defined( 'HOUR_IN_SECONDS' ) ? \HOUR_IN_SECONDS : 3600;
		$old_response->validated_at = $validated_at;
		$old_response->tried        = isset( $old_response->tried ) ? (int) $old_response->tried + 1 : 1;
		$old_response->next_request = time() + $hour_sec;
		$this->save_local_response( $old_response );
		$response_obj = $this->public_response( $old_response );
		return true;
	}

	/**
	 * Build the Elite request payload.
	 *
	 * @param string $license_key License key.
	 * @param string $email       License email.
	 * @return \stdClass
	 */
	private function get_request_payload( $license_key, $email ) {
		$payload               = new \stdClass();
		$payload->license_key  = $license_key;
		$payload->email        = ! empty( $email ) ? $email : '';
		$payload->domain       = $this->get_domain();
		$payload->app_version  = (string) $this->config['version'];
		$payload->product_id   = (string) $this->config['product_id'];
		$payload->product_base = (string) $this->config['product_base'];
		return $payload;
	}

	/**
	 * Send an encrypted request to Elite Licenser.
	 *
	 * @param string $relative_url Relative endpoint.
	 * @param object $data         Request object.
	 * @return object
	 */
	private function request( $relative_url, $data ) {
		$error                   = new \stdClass();
		$error->status           = false;
		$error->msg              = __( 'Empty response from the license server.', 'wooptions-pro' );
		$error->data             = null;
		$error->is_request_error = false;

		$json = wp_json_encode( $data );
		if ( false === $json ) {
			$error->msg = __( 'Unable to encode the license request.', 'wooptions-pro' );
			return $error;
		}

		$request_key = isset( $this->config['request_key'] ) ? (string) $this->config['request_key'] : '';
		$body        = '' !== $request_key ? $this->encrypt( $json ) : $json;
		$url         = trailingslashit( (string) $this->config['server_url'] ) . ltrim( $relative_url, '/' );
		$response    = wp_remote_post(
			$url,
			array(
				'method'      => 'POST',
				'sslverify'   => true,
				'timeout'     => 20,
				'redirection' => 3,
				'httpversion' => '1.0',
				'blocking'    => true,
				'headers'     => array(
					'Content-Type' => 'text/plain; charset=UTF-8',
				),
				'body'        => $body,
				'cookies'     => array(),
			)
		);

		if ( is_wp_error( $response ) ) {
			$error->msg              = $response->get_error_message();
			$error->is_request_error = true;
			return $error;
		}

		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			$error->msg              = sprintf(
				/* translators: %d HTTP response code. */
				__( 'The license server returned HTTP %d.', 'wooptions-pro' ),
				(int) wp_remote_retrieve_response_code( $response )
			);
			$error->is_request_error = true;
			return $error;
		}

		$body = (string) wp_remote_retrieve_body( $response );
		if ( '' === $body || 'GET404' === $body ) {
			$error->is_request_error = true;
			return $error;
		}

		return $this->process_response( $body );
	}

	/**
	 * Decode an Elite response.
	 *
	 * @param string $body Response body.
	 * @return object
	 */
	private function process_response( $body ) {
		$decoded = json_decode( $body );
		if ( ! is_object( $decoded ) ) {
			$decoded = json_decode( $this->decrypt( $body ) );
		}

		if ( is_object( $decoded ) ) {
			if ( ! isset( $decoded->is_request_error ) ) {
				$decoded->is_request_error = false;
			}
			return $decoded;
		}

		$error                   = new \stdClass();
		$error->status           = false;
		$error->msg              = __( 'Unable to decode the license server response.', 'wooptions-pro' );
		$error->data             = null;
		$error->is_request_error = true;
		return $error;
	}

	/**
	 * Encrypt data using Elite Licenser's format.
	 *
	 * @param string $plain_text Plain data.
	 * @param string $password   Optional password; defaults to product request key.
	 * @return string
	 */
	private function encrypt( $plain_text, $password = '' ) {
		$password = '' !== $password ? $password : (string) $this->config['request_key'];
		$key      = substr( hash( 'sha256', $password, true ), 0, 32 );
		$iv       = substr( strtoupper( md5( $password ) ), 0, 16 );
		$wrapped  = wp_rand( 10, 99 ) . $plain_text . wp_rand( 10, 99 );
		$cipher   = openssl_encrypt( $wrapped, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv );
		return false === $cipher ? '' : base64_encode( $cipher );
	}

	/**
	 * Decrypt Elite Licenser payload data.
	 *
	 * @param string $encrypted Encrypted data.
	 * @param string $password  Optional password; defaults to product request key.
	 * @return string
	 */
	private function decrypt( $encrypted, $password = '' ) {
		$password = '' !== $password ? $password : (string) $this->config['request_key'];
		$decoded  = base64_decode( $encrypted, true );
		if ( false === $decoded ) {
			return '';
		}

		$key   = substr( hash( 'sha256', $password, true ), 0, 32 );
		$iv    = substr( strtoupper( md5( $password ) ), 0, 16 );
		$plain = openssl_decrypt( $decoded, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv );
		if ( false === $plain || strlen( $plain ) < 4 ) {
			return '';
		}
		return substr( $plain, 2, -2 );
	}

	/**
	 * Safely unserialize a decrypted stdClass response.
	 *
	 * @param string $serialized Serialized value.
	 * @return object|null
	 */
	private function safe_unserialize_object( $serialized ) {
		if ( '' === $serialized ) {
			return null;
		}
		$value = @unserialize( $serialized, array( 'allowed_classes' => array( 'stdClass' ) ) );
		return is_object( $value ) ? $value : null;
	}

	/**
	 * Store the local response encrypted with the current site URL.
	 *
	 * @param object $response Response object.
	 * @return void
	 */
	private function save_local_response( $response ) {
		$encrypted = $this->encrypt( serialize( $response ), $this->get_domain() );
		update_option( $this->response_option, $encrypted, false );
	}

	/**
	 * Read the encrypted local response.
	 *
	 * @return object|null
	 */
	private function get_local_response() {
		$encrypted = get_option( $this->response_option, '' );
		if ( ! is_string( $encrypted ) || '' === $encrypted ) {
			return null;
		}
		return $this->safe_unserialize_object( $this->decrypt( $encrypted, $this->get_domain() ) );
	}

	/**
	 * Create a response copy safe for higher-level code.
	 *
	 * @param object $response Stored response.
	 * @return object
	 */
	private function public_response( $response ) {
		$copy = clone $response;
		unset( $copy->next_request, $copy->tried );
		return $copy;
	}

	/**
	 * Determine whether an Elite date represents an expired license.
	 *
	 * @param string $date Date string.
	 * @return bool
	 */
	private function is_expired( $date ) {
		$normalized = strtolower( trim( $date ) );
		if ( '' === $normalized || in_array( $normalized, array( 'no expiry', 'unlimited', 'lifetime' ), true ) ) {
			return false;
		}
		$timestamp = strtotime( $date );
		return false !== $timestamp && $timestamp < time();
	}

	/**
	 * Build an Elite renewal URL when its renewal window is active.
	 *
	 * @param object $response Response object.
	 * @param string $type     s=support, l=license.
	 * @return string
	 */
	private function get_renew_link( $response, $type = 's' ) {
		if ( empty( $response->renew_link ) || empty( $response->license_key ) ) {
			return '';
		}

		$date = 's' === $type ? (string) $response->support_end : (string) $response->expire_date;
		$norm = strtolower( trim( $date ) );
		$show = false;

		if ( 's' === $type && 'no support' === $norm ) {
			$show = true;
		} elseif ( ! in_array( $norm, array( 'unlimited', 'no expiry', 'lifetime' ), true ) ) {
			$timestamp = strtotime( $date );
			$show      = false !== $timestamp && strtotime( '+30 days', $timestamp ) < time();
		}

		if ( ! $show ) {
			return '';
		}

		return add_query_arg(
			array(
				'type' => $type,
				'lic'  => (string) $response->license_key,
			),
			(string) $response->renew_link
		);
	}

	/**
	 * Get the exact site value used by the working generated client.
	 *
	 * @return string
	 */
	public function get_domain() {
		return function_exists( 'site_url' ) ? (string) site_url() : '';
	}
}
