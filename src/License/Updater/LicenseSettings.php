<?php
/**
 * Elite Licenser settings controller and AJAX endpoints.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License\Updater;

defined( 'ABSPATH' ) || exit;

/**
 * License admin page controller and AJAX handler.
 */
class LicenseSettings {

	/** @var LicenseSettings|null */
	private static $instance = null;

	/** @var EliteLicensing|null */
	private $licensing = null;

	/** @var array<string,mixed> */
	private $menuArgs = array(); // phpcs:ignore WordPress.NamingConventions.ValidVariableName.PropertyNotSnakeCase

	/** @var array<string,mixed> */
	private $config = array();

	/**
	 * Register controller and AJAX actions.
	 *
	 * @param EliteLicensing|null $licensing Client.
	 * @param array<string,mixed> $config    Labels and links.
	 * @return LicenseSettings
	 */
	public function register( $licensing, $config = array() ) {
		if ( self::$instance ) {
			return self::$instance;
		}

		if ( ! $licensing ) {
			try {
				$licensing = EliteLicensing::getInstance();
			} catch ( \Exception $e ) {
				return new self();
			}
		}

		$this->licensing = $licensing;
		$this->config    = wp_parse_args(
			$config,
			array(
				'menu_title'   => 'License',
				'page_title'   => 'WooOptions Pro License',
				'title'        => 'License',
				'description'  => 'Manage your license settings for WooOptions Pro.',
				'license_key'  => 'License Key',
				'purchase_url' => 'https://themefic.com/plugins/woooptions-pro/',
				'account_url'  => 'https://portal.themefic.com/my-account/',
				'plugin_name'  => 'WooOptions Pro',
			)
		);

		$ajax_prefix = 'wp_ajax_' . $this->licensing->getConfig( 'slug' ) . '_license';
		add_action( $ajax_prefix . '_activate', array( $this, 'handleLicenseActivateAjax' ) );
		add_action( $ajax_prefix . '_deactivate', array( $this, 'handleLicenseDeactivateAjax' ) );

		self::$instance = $this;
		return self::$instance;
	}

	/**
	 * Access singleton instance.
	 *
	 * @return LicenseSettings
	 */
	public static function getInstance() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		return self::$instance ? self::$instance : new self();
	}

	/**
	 * Merge configuration options.
	 *
	 * @param array<string,mixed> $config Settings.
	 * @return LicenseSettings
	 */
	public function setConfig( $config = array() ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		$this->config = wp_parse_args( $config, $this->config );
		return $this;
	}

	/**
	 * AJAX license activation handler.
	 *
	 * @return void
	 */
	public function handleLicenseActivateAjax() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		$this->authorize_ajax_request();

		$license_key   = isset( $_POST['license_key'] ) ? sanitize_text_field( wp_unslash( $_POST['license_key'] ) ) : '';
		$license_email = isset( $_POST['license_email'] ) ? sanitize_email( wp_unslash( $_POST['license_email'] ) ) : '';

		if ( '' === $license_key ) {
			wp_send_json_error( array( 'message' => __( 'Please enter your license key.', 'wooptions-pro' ) ), 422 );
		}
		if ( '' !== $license_email && ! is_email( $license_email ) ) {
			wp_send_json_error( array( 'message' => __( 'Enter a valid purchase email or leave the field empty.', 'wooptions-pro' ) ), 422 );
		}

		$current = $this->licensing->getStatus( false );
		if (
			is_array( $current )
			&& 'valid' === ( $current['status'] ?? '' )
			&& ! empty( $current['license_key'] )
			&& hash_equals( (string) $current['license_key'], $license_key )
		) {
			wp_send_json_success( array( 'message' => __( 'This license is already active.', 'wooptions-pro' ) ) );
		}

		$activated = $this->licensing->activate( $license_key, $license_email );
		if ( is_wp_error( $activated ) ) {
			wp_send_json_error(
				array(
					'message' => $activated->get_error_message(),
					'status'  => 'api_error',
				),
				422
			);
		}

		wp_send_json_success(
			array(
				'message' => __( 'License activated successfully.', 'wooptions-pro' ),
				'status'  => 'active',
			)
		);
	}

	/**
	 * AJAX license deactivation handler.
	 *
	 * @return void
	 */
	public function handleLicenseDeactivateAjax() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		$this->authorize_ajax_request();

		$deactivated = $this->licensing->deactivate();

		if ( is_wp_error( $deactivated ) ) {
			wp_send_json_error( array( 'message' => $deactivated->get_error_message() ), 422 );
		}

		wp_send_json_success( array( 'message' => __( 'License deactivated successfully.', 'wooptions-pro' ) ) );
	}

	/**
	 * Verify capability and nonce for AJAX operations.
	 *
	 * @return void
	 */
	private function authorize_ajax_request() {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( 'manage_wooptions-pro' ) ) {
			wp_send_json_error( array( 'message' => __( 'You do not have permission to manage the license.', 'wooptions-pro' ) ), 403 );
		}

		$nonce = isset( $_POST['_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, 'wooptions_pro_license_nonce' ) && ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			wp_send_json_error( array( 'message' => __( 'Security verification failed. Please refresh the page and try again.', 'wooptions-pro' ) ), 403 );
		}
	}

	/**
	 * Queue admin menu page.
	 *
	 * @param array<string,mixed> $args Menu configuration.
	 * @return LicenseSettings|void
	 */
	public function addPage( $args ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		if ( ! $this->licensing ) {
			return;
		}

		$this->menuArgs = wp_parse_args(
			$args,
			array(
				'type'        => 'submenu',
				'page_title'  => isset( $this->config['page_title'] ) ? $this->config['page_title'] : 'License',
				'menu_title'  => isset( $this->config['menu_title'] ) ? $this->config['menu_title'] : 'License',
				'capability'  => 'manage_options',
				'parent_slug' => 'wooptions-pro',
				'menu_slug'   => 'wooptions-pro-license',
				'position'    => 99,
			)
		);
		add_action( 'admin_menu', array( $this, 'createMenuPage' ), 99 );
		return $this;
	}

	/**
	 * Create menu page in WordPress admin.
	 *
	 * @return void
	 */
	public function createMenuPage() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		add_submenu_page(
			$this->menuArgs['parent_slug'],
			$this->menuArgs['page_title'],
			$this->menuArgs['menu_title'],
			$this->menuArgs['capability'],
			$this->menuArgs['menu_slug'],
			array( $this, 'renderLicensingContent' ),
			$this->menuArgs['position']
		);
	}

	/**
	 * Mask middle portion of a license key.
	 *
	 * @param string $key   Raw key.
	 * @param int    $start Visible prefix length.
	 * @param int    $end   Visible suffix length.
	 * @return string
	 */
	public static function mask_license_key( $key, $start = 4, $end = 4 ) {
		$length = strlen( $key );
		if ( $length <= $start + $end ) {
			return $key;
		}
		$prefix = substr( $key, 0, $start );
		$suffix = substr( $key, -$end );
		return $prefix . str_repeat( '•', max( 8, $length - $start - $end ) ) . $suffix;
	}

	/**
	 * Render the license management page.
	 *
	 * Uses the single WooOptions Pro React shell with initialRoute 'license'
	 * so there is NEVER a duplicate or mismatched header.
	 *
	 * @return void
	 */
	public function renderLicensingContent() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( 'manage_wooptions-pro' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage WooOptions Pro.', 'wooptions-pro' ) );
		}

		echo '<div class="wrap wof-admin-wrap">';
		echo '<div id="wooptions-pro-admin-root">';
		echo '<div class="wof-admin-loading"><span class="spinner is-active"></span><p>' . esc_html__( 'Opening License Manager…', 'wooptions-pro' ) . '</p></div>';
		echo '</div>';
		echo '<noscript><div class="notice notice-error"><p>' . esc_html__( 'WooOptions Pro requires JavaScript to manage licenses.', 'wooptions-pro' ) . '</p></div></noscript>';
		echo '</div>';
	}
}
