<?php
/**
 * Elite Licenser protocol client and WordPress updater.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License\Updater;

defined('ABSPATH') || exit;

/**
 * Low-level Elite Licenser client for WooOptions Pro.
 */
class EliteLicenserBase
{

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
	public function __construct($config)
	{
		$defaults = array(
			'request_key' => '0788A6B548D50039',
			'product_id' => '13',
			'product_base' => 'woooptions-pro',
			'server_url' => 'https://license.themefic.com/wp-json/licensor/',
			'plugin_file' => defined('WOOPTIONS_PRO_FILE') ? WOOPTIONS_PRO_FILE : '',
			'basename' => defined('WOOPTIONS_PRO_BASENAME') ? WOOPTIONS_PRO_BASENAME : '',
			'version' => defined('WOOPTIONS_PRO_VERSION') ? WOOPTIONS_PRO_VERSION : '1.0.0',
			'slug' => 'wooptions-pro',
		);
		$this->config = wp_parse_args($config, $defaults);
		$this->response_option = 'wooptions_pro_elite_response_' . hash('crc32b', $this->config['product_id'] . $this->config['request_key'] . $this->get_domain());
		$this->update_cache_key = 'wooptions_pro_update_' . hash('crc32b', $this->config['product_id'] . $this->config['request_key']);

		add_action('init', array($this, 'register_server_listeners'));
		add_filter('pre_set_site_transient_update_plugins', array($this, 'filter_update_plugins'));
		add_filter('plugins_api', array($this, 'filter_plugins_api'), 10, 3);
	}

	/**
	 * Configuration accessor.
	 *
	 * @param string $key Config key.
	 * @return mixed
	 */
	public function get_config($key)
	{
		return isset($this->config[$key]) ? $this->config[$key] : null;
	}

	/**
	 * Attach a callback run when server-requested removal occurs.
	 *
	 * @param callable $callback Handler.
	 * @return void
	 */
	public function on_remote_delete($callback)
	{
		if (is_callable($callback)) {
			$this->delete_callbacks[] = $callback;
		}
	}

	/**
	 * Normalized failure category for the last check.
	 *
	 * @return string 'network'|'invalid'|'grace'|''
	 */
	public function get_last_failure_type()
	{
		return $this->last_failure_type;
	}

	/**
	 * Register Elite's incoming webhook handler.
	 *
	 * @return void
	 */
	public function register_server_listeners()
	{
		$expected = hash('crc32b', $this->config['product_id'] . $this->config['request_key'] . $this->get_domain()) . '_handle';
		$action = isset($_GET['action']) ? sanitize_key(wp_unslash($_GET['action'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ('' === $action || !hash_equals($expected, $action)) {
			return;
		}

		$type = isset($_GET['type']) ? sanitize_key(wp_unslash($_GET['type'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$this->handle_server_request($type);
		exit;
	}

	/**
	 * Validate a license against the remote server or return the cached verification.
	 *
	 * @param string      $license_key  Plain license key.
	 * @param string      $email        Purchase email.
	 * @param string      $message      Status message reference.
	 * @param object|null $response_obj Normalized object reference.
	 * @param bool        $force_check  Bypass the local cache.
	 * @return bool
	 */
	public function check_license($license_key, $email, &$message = '', &$response_obj = null, $force_check = false)
	{
		$license_key = sanitize_text_field($license_key);
		$email = sanitize_email($email);

		if ('' === $license_key) {
			$message = __('Please enter a license key.', 'wooptions-pro');
			$this->last_failure_type = 'invalid';
			return false;
		}

		$old_response = $this->get_local_response();

		if (!$force_check && is_object($old_response) && !empty($old_response->is_valid)) {
			if (!empty($old_response->license_key) && hash_equals((string) $old_response->license_key, $license_key)) {
				$expires = isset($old_response->expire_date) ? (string) $old_response->expire_date : '';
				if ('no expiry' === strtolower($expires) || 'lifetime' === strtolower($expires) || '' === $expires) {
					$response_obj = $this->public_response($old_response);
					$message = isset($old_response->msg) ? (string) $old_response->msg : __('License is active.', 'wooptions-pro');
					$this->last_failure_type = '';
					return true;
				}
				$expire_time = strtotime($expires);
				if (false !== $expire_time && $expire_time > current_time('timestamp', true)) {
					$response_obj = $this->public_response($old_response);
					$message = isset($old_response->msg) ? (string) $old_response->msg : __('License is active.', 'wooptions-pro');
					$this->last_failure_type = '';
					return true;
				}
			}
		}

		$payload = $this->get_request_payload($license_key, $email);
		$response = $this->request('product/active/' . rawurlencode((string) $this->config['product_id']), $payload);

		if (!empty($response->is_request_error)) {
			if ($this->use_temporary_grace($old_response, $response_obj)) {
				$this->last_failure_type = 'grace';
				$message = __('Using cached license during a temporary connection issue.', 'wooptions-pro');
				return true;
			}
			$this->last_failure_type = 'network';
			$message = !empty($response->msg) ? (string) $response->msg : __('Unable to connect to the license server.', 'wooptions-pro');
			return false;
		}

		if (!empty($response->message) && empty($response->status)) {
			$this->remove_local_response(false);
			$this->last_failure_type = 'invalid';
			$message = !empty($response->message) ? (string) $response->message : __('The license server returned an error.', 'wooptions-pro');
			return false;
		}

		if (empty($response->status)) {
			$this->remove_local_response(false);
			$this->last_failure_type = 'invalid';
			$message = !empty($response->msg) ? (string) $response->msg : __('License activation failed.', 'wooptions-pro');
			return false;
		}

		if (empty($response->data) || !is_string($response->data)) {
			$this->remove_local_response(false);
			$this->last_failure_type = 'invalid';
			$message = __('The license server returned incomplete data.', 'wooptions-pro');
			return false;
		}

		$license = $this->decrypt_server_payload($response->data, $this->get_domain());
		if (!is_object($license)) {
			$license = $this->decrypt_server_payload($response->data, (string) $this->config['request_key']);
		}

		if (!is_object($license) || empty($license->is_valid)) {
			$this->remove_local_response(false);
			$this->last_failure_type = 'invalid';
			$message = !empty($response->msg) ? (string) $response->msg : __('The license is not valid for this website.', 'wooptions-pro');
			return false;
		}

		$request_hours = isset($license->request_duration) && (int) $license->request_duration > 0
			? (int) $license->request_duration
			: 24;

		$stored = new \stdClass();
		$stored->is_valid = true;
		$stored->validated_at = time();
		$stored->next_request = time() + ($request_hours * (defined('HOUR_IN_SECONDS') ? \HOUR_IN_SECONDS : 3600));
		$stored->expire_date = isset($license->expire_date) ? (string) $license->expire_date : '';
		$stored->support_end = isset($license->support_end) ? (string) $license->support_end : '';
		$stored->license_title = isset($license->license_title) ? (string) $license->license_title : '';
		$stored->license_key = $license_key;
		$stored->license_email = $email;
		$stored->msg = !empty($response->msg) ? (string) $response->msg : __('License activated successfully.', 'wooptions-pro');
		$stored->renew_link = isset($license->renew_link) ? (string) $license->renew_link : '';
		$stored->expire_renew_link = $this->get_renew_link($stored, 'l');
		$stored->support_renew_link = $this->get_renew_link($stored, 's');
		$stored->tried = 0;

		$this->save_local_response($stored);
		$this->clear_update_info();

		$response_obj = $this->public_response($stored);
		$message = $stored->msg;
		$this->last_failure_type = '';
		return true;
	}

	/**
	 * Deactivate the currently registered domain.
	 *
	 * ALWAYS resets local state so the customer is never trapped.
	 *
	 * @param string $message Response message.
	 * @return bool
	 */
	public function deactivate(&$message = '')
	{
		$stored = $this->get_local_response();

		if (!is_object($stored) || empty($stored->license_key)) {
			$this->remove_local_response(true);
			$this->clear_update_info();
			$message = __('License deactivated.', 'wooptions-pro');
			return true;
		}

		$payload = $this->get_request_payload(
			(string) $stored->license_key,
			isset($stored->license_email) ? (string) $stored->license_email : ''
		);

		// Always clean up local state immediately so deactivation never fails locally.
		$this->remove_local_response(true);
		$this->clear_update_info();

		$response = $this->request('product/deactive/' . rawurlencode((string) $this->config['product_id']), $payload);

		if (!empty($response->is_request_error)) {
			$message = __('License deactivated locally (license server was unreachable).', 'wooptions-pro');
			return true;
		}

		if (empty($response->status)) {
			$message = !empty($response->msg) ? (string) $response->msg : __('License deactivated locally.', 'wooptions-pro');
			return true;
		}

		$message = !empty($response->msg) ? (string) $response->msg : __('License deactivated successfully.', 'wooptions-pro');
		return true;
	}

	/**
	 * Return the cached Elite response without internal scheduling fields.
	 *
	 * @return object|null
	 */
	public function get_register_info()
	{
		$stored = $this->get_local_response();
		return is_object($stored) ? $this->public_response($stored) : null;
	}

	/**
	 * Clear only the locally cached response.
	 *
	 * @param bool $run_callbacks Whether to clear higher-level credentials too.
	 * @return void
	 */
	public function remove_local_response($run_callbacks = true)
	{
		delete_option($this->response_option);
		if ($run_callbacks) {
			foreach ($this->delete_callbacks as $cb) {
				call_user_func($cb);
			}
		}
	}

	/**
	 * Whether a periodic validation should run.
	 *
	 * @param string $key   License key.
	 * @param string $email Email.
	 * @return bool
	 */
	public function is_validation_due($key, $email = '')
	{
		$stored = $this->get_local_response();
		if (!is_object($stored) || empty($stored->is_valid)) {
			return true;
		}
		if (empty($stored->license_key) || !hash_equals((string) $stored->license_key, (string) $key)) {
			return true;
		}
		return time() >= (int) ($stored->next_request ?? 0);
	}

	/**
	 * Return download and package details for updates.
	 *
	 * @param bool $force_check Bypass local transient.
	 * @return object|null
	 */
	public function get_update_info($force_check = false)
	{
		if (!$force_check) {
			$cached = get_transient($this->update_cache_key);
			if (false !== $cached) {
				return is_object($cached) ? $cached : null;
			}
		}

		$response = $this->request('product/update/' . rawurlencode((string) $this->config['product_id']), null, 'GET');
		if (!is_object($response) || empty($response->status) || empty($response->data)) {
			set_transient($this->update_cache_key, false, 2 * (defined('HOUR_IN_SECONDS') ? \HOUR_IN_SECONDS : 3600));
			return null;
		}

		$data = $response->data;
		if (is_object($data)) {
			$data->version = !empty($data->new_version) ? (string) $data->new_version : '';
			$data->package = !empty($data->download_link) ? (string) $data->download_link : '';
			$data->sections = isset($data->sections) ? (array) $data->sections : array();
			$data->icons = isset($data->icons) ? (array) $data->icons : array();
			$data->banners = isset($data->banners) ? (array) $data->banners : array();
		}

		set_transient($this->update_cache_key, $data, 12 * (defined('HOUR_IN_SECONDS') ? \HOUR_IN_SECONDS : 3600));
		return $data;
	}

	/**
	 * Clear the update transient after activation/deactivation.
	 *
	 * @return void
	 */
	public function clear_update_info()
	{
		delete_transient($this->update_cache_key);
	}

	/**
	 * Filter WordPress core's update check transient.
	 *
	 * @param object|false $transient Transient.
	 * @return object|false
	 */
	public function filter_update_plugins($transient)
	{
		if (!is_object($transient)) {
			return $transient;
		}

		if (class_exists('\WooOptionsPro\License\LicenseGate') && !\WooOptionsPro\License\LicenseGate::can_receive_updates()) {
			return $transient;
		} elseif (class_exists('WooOptionsPro_License_Gate') && !\WooOptionsPro_License_Gate::can_receive_updates()) {
			return $transient;
		}

		$update = $this->get_update_info(false);
		if (!is_object($update) || empty($update->version)) {
			return $transient;
		}

		if (version_compare((string) $this->config['version'], (string) $update->version, '<')) {
			$item = new \stdClass();
			$item->slug = (string) $this->config['slug'];
			$item->plugin = (string) $this->config['basename'];
			$item->new_version = (string) $update->version;
			$item->url = !empty($update->url) ? (string) $update->url : '';
			$item->package = !empty($update->package) ? (string) $update->package : '';
			$item->icons = isset($update->icons) ? (array) $update->icons : array();
			$item->banners = isset($update->banners) ? (array) $update->banners : array();

			$transient->response[(string) $this->config['basename']] = $item;
		}

		return $transient;
	}

	/**
	 * Filter the plugin information modal shown in wp-admin.
	 *
	 * @param false|object|array $result Result.
	 * @param string             $action Action.
	 * @param object             $args   Args.
	 * @return false|object|array
	 */
	public function filter_plugins_api($result, $action, $args)
	{
		if ('plugin_information' !== $action || !isset($args->slug) || (string) $args->slug !== (string) $this->config['slug']) {
			return $result;
		}

		$update = $this->get_update_info(false);
		if (!is_object($update)) {
			return $result;
		}

		$info = new \stdClass();
		$info->name = 'WooOptions Pro';
		$info->slug = (string) $this->config['slug'];
		$info->version = !empty($update->version) ? (string) $update->version : (string) $this->config['version'];
		$info->author = '<a href="https://themefic.com">Themefic</a>';
		$info->homepage = !empty($update->url) ? (string) $update->url : 'https://themefic.com/plugins/woooptions-pro/';
		$info->download_link = !empty($update->package) ? (string) $update->package : '';
		$info->sections = isset($update->sections) ? (array) $update->sections : array('description' => 'WooOptions Pro');
		$info->banners = isset($update->banners) ? (array) $update->banners : array();
		$info->icons = isset($update->icons) ? (array) $update->icons : array();

		return $info;
	}

	/**
	 * Handle server webhook call.
	 *
	 * @param string $type Action type.
	 * @return void
	 */
	private function handle_server_request($type)
	{
		switch (strtolower(trim($type))) {
			case 'rl':
			case 'dl':
				$this->remove_local_response(true);
				$this->clear_update_info();
				$out = new \stdClass();
				$out->product = (string) $this->config['product_id'];
				$out->status = true;
				header('Content-Type: text/plain; charset=utf-8');
				echo esc_html($this->encrypt_client_payload($out, $this->config['request_key']));
				return;
			default:
				status_header(400);
				echo 'Unknown request';
				return;
		}
	}

	/**
	 * Use cached license during a temporary network outage.
	 *
	 * @param object|null $old_response Stored response.
	 * @param object|null $response_obj Output.
	 * @return bool
	 */
	private function use_temporary_grace($old_response, &$response_obj)
	{
		if (!is_object($old_response) || empty($old_response->is_valid)) {
			return false;
		}

		$validated_at = (int) ($old_response->validated_at ?? 0);
		if (0 === $validated_at) {
			return false;
		}

		$elapsed = time() - $validated_at;
		if ($elapsed > self::CONNECTION_GRACE_SECONDS) {
			return false;
		}

		$old_response->next_request = time() + (6 * (defined('HOUR_IN_SECONDS') ? \HOUR_IN_SECONDS : 3600));
		$this->save_local_response($old_response);
		$response_obj = $this->public_response($old_response);
		return true;
	}

	/**
	 * Prepare the payload for activation or deactivation requests.
	 *
	 * @param string $license_key Plain key.
	 * @param string $email       Email.
	 * @return array<string,mixed>
	 */
	private function get_request_payload($license_key, $email)
	{
		return array(
			'license_key' => $license_key,
			'license_email' => $email,
			'product_id' => (string) $this->config['product_id'],
			'product_base' => (string) $this->config['product_base'],
			'domain' => $this->get_domain(),
			'version' => (string) $this->config['version'],
			'current_time' => time(),
		);
	}

	/**
	 * Execute an HTTP request against Elite's licensor endpoint.
	 *
	 * @param string                    $endpoint Path.
	 * @param array<string,mixed>|null  $payload  Body parameters.
	 * @param string                    $method   HTTP method.
	 * @return object
	 */
	private function request($endpoint, $payload = null, $method = 'POST')
	{
		$url = trailingslashit((string) $this->config['server_url']) . ltrim($endpoint, '/');
		$args = array(
			'method' => $method,
			'timeout' => 30,
			'redirection' => 5,
			'httpversion' => '1.1',
			'blocking' => true,
			'headers' => array(
				'Accept' => 'application/json',
				'User-Agent' => 'WooOptionsPro/' . (string) $this->config['version'] . '; ' . home_url(),
			),
		);

		if ('POST' === $method && null !== $payload) {
			$args['headers']['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
			$args['body'] = $payload;
		}

		$raw = wp_remote_request($url, $args);

		if (is_wp_error($raw)) {
			$err = new \stdClass();
			$err->is_request_error = true;
			$err->status = false;
			$err->msg = $raw->get_error_message();
			return $err;
		}

		$code = wp_remote_retrieve_response_code($raw);
		$body = wp_remote_retrieve_body($raw);

		if ($code < 200 || $code >= 300) {
			$err = new \stdClass();
			$err->is_request_error = true;
			$err->status = false;
			$err->msg = sprintf(
				/* translators: %d: HTTP status code. */
				__('The license server returned an HTTP %d error.', 'wooptions-pro'),
				(int) $code
			);
			return $err;
		}

		$decoded = json_decode($body);
		if (!is_object($decoded)) {
			$err = new \stdClass();
			$err->is_request_error = true;
			$err->status = false;
			$err->msg = __('The license server response was not valid JSON.', 'wooptions-pro');
			return $err;
		}

		return $decoded;
	}

	/**
	 * Return the registered domain.
	 *
	 * @return string
	 */
	public function get_domain()
	{
		if (defined('WPN_FORCE_HOST') && constant('WPN_FORCE_HOST')) {
			return strtolower(trim((string) constant('WPN_FORCE_HOST')));
		}

		$raw_url = function_exists('home_url') ? home_url() : (function_exists('site_url') ? site_url() : '');
		if (!empty($raw_url)) {
			$host = function_exists('wp_parse_url') ? (string) wp_parse_url($raw_url, PHP_URL_HOST) : (string) parse_url($raw_url, PHP_URL_HOST);
			if ('' !== $host) {
				return strtolower(trim($host));
			}
		}

		$server_name = isset($_SERVER['SERVER_NAME']) ? (function_exists('sanitize_text_field') ? sanitize_text_field(function_exists('wp_unslash') ? wp_unslash($_SERVER['SERVER_NAME']) : $_SERVER['SERVER_NAME']) : strip_tags((string) $_SERVER['SERVER_NAME'])) : '';
		return strtolower(trim($server_name));
	}

	/**
	 * Build a renewal link from response metadata.
	 *
	 * @param object $stored Stored record.
	 * @param string $type   'l' for license, 's' for support.
	 * @return string
	 */
	private function get_renew_link($stored, $type = 'l')
	{
		$base = !empty($stored->renew_link) ? (string) $stored->renew_link : '';
		if ('' === $base) {
			return '';
		}
		return add_query_arg(
			array(
				'renew_type' => $type,
				'product_id' => (string) $this->config['product_id'],
				'license_key' => rawurlencode((string) $stored->license_key),
			),
			$base
		);
	}

	/**
	 * Strip internal scheduling properties.
	 *
	 * @param object $stored Stored record.
	 * @return object
	 */
	private function public_response($stored)
	{
		$public = new \stdClass();
		$public->is_valid = !empty($stored->is_valid);
		$public->expire_date = isset($stored->expire_date) ? (string) $stored->expire_date : '';
		$public->support_end = isset($stored->support_end) ? (string) $stored->support_end : '';
		$public->license_title = isset($stored->license_title) ? (string) $stored->license_title : '';
		$public->license_key = isset($stored->license_key) ? (string) $stored->license_key : '';
		$public->license_email = isset($stored->license_email) ? (string) $stored->license_email : '';
		$public->msg = isset($stored->msg) ? (string) $stored->msg : '';
		$public->renew_link = isset($stored->renew_link) ? (string) $stored->renew_link : '';
		$public->expire_renew_link = isset($stored->expire_renew_link) ? (string) $stored->expire_renew_link : '';
		$public->support_renew_link = isset($stored->support_renew_link) ? (string) $stored->support_renew_link : '';
		return $public;
	}

	/**
	 * Read stored raw response object.
	 *
	 * @return object|null
	 */
	private function get_local_response()
	{
		$raw = get_option($this->response_option, null);
		if (empty($raw) || !is_string($raw)) {
			return null;
		}

		$decrypted = $this->decrypt_server_payload($raw, (string) $this->config['request_key']);
		if (is_object($decrypted)) {
			return $decrypted;
		}

		$decrypted = $this->decrypt_server_payload($raw, $this->get_domain());
		return is_object($decrypted) ? $decrypted : null;
	}

	/**
	 * Store encrypted response object.
	 *
	 * @param object $response Response object.
	 * @return void
	 */
	private function save_local_response($response)
	{
		$encrypted = $this->encrypt_client_payload($response, (string) $this->config['request_key']);
		update_option($this->response_option, $encrypted, false);
	}

	/**
	 * Decrypt Elite Licenser payload using AES-256-CBC.
	 *
	 * @param string $ciphertext Base64 ciphertext.
	 * @param string $password   Key.
	 * @return object|false
	 */
	private function decrypt_server_payload($ciphertext, $password)
	{
		if (!function_exists('openssl_decrypt') || '' === trim((string) $ciphertext)) {
			return false;
		}

		$key = substr(hash('sha256', (string) $password, true), 0, 32);
		$iv = substr(strtoupper(md5((string) $password)), 0, 16);
		$decoded = base64_decode((string) $ciphertext, true);
		if (false === $decoded) {
			return false;
		}

		$plaintext = openssl_decrypt($decoded, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
		if (false === $plaintext || strlen($plaintext) <= 4) {
			return false;
		}

		// Licenser prepends 2 random digits and appends 2 random digits.
		$unpadded = substr($plaintext, 2, -2);

		// Elite Licenser serializes the payload using PHP serialize.
		$unserialized = @unserialize($unpadded); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		return is_object($unserialized) ? $unserialized : false;
	}

	/**
	 * Encrypt object payload for local storage or webhook reply.
	 *
	 * @param object $obj      Data.
	 * @param string $password Key.
	 * @return string
	 */
	private function encrypt_client_payload($obj, $password)
	{
		if (!function_exists('openssl_encrypt')) {
			return '';
		}

		$serialized = serialize($obj);
		$padded = wp_rand(10, 99) . $serialized . wp_rand(10, 99);
		$key = substr(hash('sha256', (string) $password, true), 0, 32);
		$iv = substr(strtoupper(md5((string) $password)), 0, 16);
		$cipher = openssl_encrypt($padded, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);

		return false === $cipher ? '' : base64_encode($cipher);
	}
}
