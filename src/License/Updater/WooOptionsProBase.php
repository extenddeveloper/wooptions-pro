<?php
/**
 * WooOptions Pro Elite Licenser Base class provided by licenser.
 *
 * @package WooOptionsPro
 */

namespace WooOptionsPro\License\Updater;

defined( 'ABSPATH' ) || exit;

class WooOptionsProBase {
	public $key = "0788A6B548D50039";
	private $product_id = "13";
	private $product_base = "woooptions-pro";
	private $server_host = "https://license.themefic.com/wp-json/licensor/";
	/* @var self */
	private static $selfobj = null;

	public function __construct() {
		$this->initActionHandler();
	}

	public function initActionHandler() {
		$handler = hash( "crc32b", $this->product_id . $this->key . $this->getDomain() ) . "_handle";
		if ( isset( $_GET['action'] ) && $_GET['action'] == $handler ) {
			$this->handleServerRequest();
			exit;
		}
	}

	public function handleServerRequest() {
		$type = isset( $_GET['type'] ) ? strtolower( $_GET['type'] ) : "";
		switch ( $type ) {
			case "rl": // remove license
				$this->removeOldResponse();
				$obj          = new \stdClass();
				$obj->product = $this->product_id;
				$obj->status  = true;
				echo $this->encryptObj( $obj );
				return;
			case "dl": // delete app
				$obj          = new \stdClass();
				$obj->product = $this->product_id;
				$obj->status  = true;
				$this->removeOldResponse();
				echo $this->encryptObj( $obj );
				return;
			default:
				return;
		}
	}

	public function __plugin_updateInfo() {
		if ( function_exists( "file_get_contents" ) ) {
			$body         = file_get_contents( $this->server_host . "product/update/" . $this->product_id );
			$responseJson = json_decode( $body );
			if ( is_object( $responseJson ) && ! empty( $responseJson->status ) && ! empty( $responseJson->data->new_version ) ) {

				$responseJson->data->new_version = ! empty( $responseJson->data->new_version ) ? $responseJson->data->new_version : "";
				$responseJson->data->version     = $responseJson->data->new_version;
				$responseJson->data->url         = ! empty( $responseJson->data->url ) ? $responseJson->data->url : "";
				$responseJson->data->package     = ! empty( $responseJson->data->download_link ) ? $responseJson->data->download_link : "";

				$responseJson->data->sections    = (array) $responseJson->data->sections;
				$responseJson->data->icons       = (array) $responseJson->data->icons;
				$responseJson->data->banners     = (array) $responseJson->data->banners;
				$responseJson->data->banners_rtl = (array) $responseJson->data->banners_rtl;

				return $responseJson->data;
			}
		}
		return null;
	}

	public static function GetPluginUpdateInfo() {
		$obj = static::getInstance();
		return $obj->__plugin_updateInfo();
	}

	/**
	 * @return WooOptionsProBase|null
	 */
	public static function &getInstance() {
		if ( empty( static::$selfobj ) ) {
			static::$selfobj = new static();
		}
		return static::$selfobj;
	}

	private function encrypt( $plainText, $password = '' ) {
		if ( empty( $password ) ) {
			$password = $this->key;
		}
		$plainText = rand( 10, 99 ) . $plainText . rand( 10, 99 );
		$method    = 'aes-256-cbc';
		$key       = substr( hash( 'sha256', $password, true ), 0, 32 );
		$iv        = substr( strtoupper( md5( $password ) ), 0, 16 );
		return base64_encode( openssl_encrypt( $plainText, $method, $key, OPENSSL_RAW_DATA, $iv ) );
	}

	private function decrypt( $encrypted, $password = '' ) {
		if ( empty( $password ) ) {
			$password = $this->key;
		}
		$method    = 'aes-256-cbc';
		$key       = substr( hash( 'sha256', $password, true ), 0, 32 );
		$iv        = substr( strtoupper( md5( $password ) ), 0, 16 );
		$decrypted = openssl_decrypt( base64_decode( $encrypted ), $method, $key, OPENSSL_RAW_DATA, $iv );
		if ( false === $decrypted ) {
			return false;
		}
		$decrypted = substr( $decrypted, 2 );
		$decrypted = substr( $decrypted, 0, - 2 );
		return $decrypted;
	}

	private function encryptObj( $obj ) {
		$text = serialize( $obj );
		return $this->encrypt( $text );
	}

	private function decryptObj( $ciphertext ) {
		$text = $this->decrypt( $ciphertext );
		return unserialize( $text );
	}

	private function getDomain() {
		if ( defined( "WPN_FORCE_HOST" ) ) {
			return WPN_FORCE_HOST;
		}
		$base_url = ( ( isset( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] == "on" ) ? "https" : "http" );
		$base_url .= "://" . ( isset( $_SERVER['HTTP_HOST'] ) ? $_SERVER['HTTP_HOST'] : "" );
		$base_url .= ( isset( $_SERVER['SCRIPT_NAME'] ) ? dirname( $_SERVER['SCRIPT_NAME'] ) : "" );
		$base_url = preg_replace( "/\/+$/", '', $base_url );
		$domain   = "";
		$matches  = array();
		if ( preg_match( "/[a-z0-9\-]{1,63}\.[a-z\.]{2,6}$[_]*?/i", $base_url, $matches ) ) {
			$domain = $matches[0];
		} else {
			$domain = $_SERVER['SERVER_NAME'];
		}
		return strtolower( trim( $domain ) );
	}

	private function getOldResponse() {
		$key = hash( "crc32b", $this->product_id . $this->key . $this->getDomain() );
		return get_option( "wpn_response_" . $key, null );
	}

	private function removeOldResponse() {
		$key = hash( "crc32b", $this->product_id . $this->key . $this->getDomain() );
		delete_option( "wpn_response_" . $key );
	}

	private function saveResponse( $response ) {
		$key = hash( "crc32b", $this->product_id . $this->key . $this->getDomain() );
		update_option( "wpn_response_" . $key, $response );
	}

	public static function CheckLicense( $license_key, &$errorMessage = "", &$responseObj = null, $version = "", $license_email = "" ) {
		$obj = static::getInstance();
		return $obj->_check_license( $license_key, $errorMessage, $responseObj, $version, $license_email );
	}

	private function _check_license( $license_key, &$errorMessage = "", &$responseObj = null, $version = "", $license_email = "" ) {
		$oldResponse = $this->getOldResponse();
		$isForce     = false;
		if ( ! empty( $oldResponse ) ) {
			$oldResponse = $this->decryptObj( $oldResponse );
			if ( is_object( $oldResponse ) && ! empty( $oldResponse->expire_date ) && ! empty( $oldResponse->is_valid ) ) {
				if ( ( $oldResponse->is_valid && $oldResponse->expire_date == "No Expiry" ) || ( ! empty( $oldResponse->expire_date ) && $oldResponse->expire_date != "No Expiry" && strtotime( $oldResponse->expire_date ) > time() ) ) {
					$responseObj = clone $oldResponse;
					return true;
				}
			}
		}

		$param = array(
			'license_key'   => $license_key,
			'license_email' => $license_email,
			'product_id'    => $this->product_id,
			'product_base'  => $this->product_base,
			'domain'        => $this->getDomain(),
			'version'       => $version,
			'current_time'  => time(),
		);

		$request_url = $this->server_host . "product/active/" . $this->product_id;
		$response    = wp_remote_post(
			$request_url,
			array(
				'method'      => 'POST',
				'timeout'     => 45,
				'redirection' => 5,
				'httpversion' => '1.0',
				'blocking'    => true,
				'headers'     => array( 'Content-Type' => 'application/x-www-form-urlencoded' ),
				'body'        => $param,
				'cookies'     => array(),
			)
		);

		if ( is_wp_error( $response ) ) {
			$errorMessage = $response->get_error_message();
			return false;
		}

		$body = wp_remote_retrieve_body( $response );
		$obj  = json_decode( $body );

		if ( ! is_object( $obj ) ) {
			$errorMessage = "Server error, please try again later.";
			return false;
		}

		if ( ! empty( $obj->status ) && ! empty( $obj->data ) ) {
			$data = $this->decryptObj( $obj->data );
			if ( is_object( $data ) && ! empty( $data->is_valid ) ) {
				$this->saveResponse( $obj->data );
				$responseObj = $data;
				return true;
			}
		}

		$errorMessage = ! empty( $obj->msg ) ? $obj->msg : "Invalid license key.";
		return false;
	}
}

// Global class alias for any licenser code referencing WooOptionsProBase without namespace.
if ( ! class_exists( 'WooOptionsProBase', false ) ) {
	class_alias( WooOptionsProBase::class, 'WooOptionsProBase' );
}
