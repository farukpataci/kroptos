<?php
/**
 * Plugin Name: KroptOS WooCommerce Connector
 * Plugin URI:  https://kroptos.com
 * Description: KroptOS çok kanallı ticaret işletim sistemi için resmi WooCommerce entegrasyon ve webhook hızlandırıcı eklentisi.
 * Version:     1.0.0
 * Author:      KroptOS Team
 * Author URI:  https://kroptos.com
 * License:     GPL-2.0+
 * Text Domain: kroptos-connector
 * Domain Path: /languages
 * WC requires at least: 5.0.0
 * WC tested up to: 9.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Doğrudan erişim engellendi
}

class KroptOS_Connector {
    const VERSION = '1.0.0';
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // WooCommerce aktif mi kontrol et
        add_action('plugins_loaded', array($this, 'init'));
    }

    public function init() {
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return;
        }

        // Kargo takip meta kutusu ve müşteri ekranı gösterimi
        add_action('add_meta_boxes', array($this, 'add_tracking_meta_box'));
        add_action('woocommerce_order_details_after_order_table', array($this, 'display_tracking_to_customer'));

        // REST API Uç Noktaları
        add_action('rest_api_init', array($this, 'register_rest_routes'));

        // Ayarlar Sayfası
        add_filter('woocommerce_get_settings_pages', array($this, 'add_settings_page'));
    }

    public function woocommerce_missing_notice() {
        echo '<div class="error"><p>' . esc_html__('KroptOS Connector çalışmak için WooCommerce eklentisine ihtiyaç duyar.', 'kroptos-connector') . '</p></div>';
    }

    /**
     * KroptOS Teşhis ve Doğrulama REST API Rotası
     */
    public function register_rest_routes() {
        register_rest_route('kroptos/v1', '/ping', array(
            'methods'  => 'GET',
            'callback' => array($this, 'rest_ping'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('kroptos/v1', '/status', array(
            'methods'  => 'GET',
            'callback' => array($this, 'rest_status'),
            'permission_callback' => array($this, 'check_api_permission'),
        ));
    }

    public function rest_ping() {
        return rest_ensure_response(array(
            'status'     => 'ok',
            'plugin'     => 'KroptOS WooCommerce Connector',
            'version'    => self::VERSION,
            'wc_version' => defined('WC_VERSION') ? WC_VERSION : 'unknown',
            'wp_version' => get_bloginfo('version'),
        ));
    }

    public function check_api_permission() {
        return current_user_can('manage_woocommerce');
    }

    public function rest_status() {
        return rest_ensure_response(array(
            'site_url'           => get_site_url(),
            'currency'           => get_woocommerce_currency(),
            'prices_include_tax' => get_option('woocommerce_prices_include_tax') === 'yes',
            'timezone'           => wc_timezone_string(),
            'orders_count'       => wc_orders_count('processing') + wc_orders_count('pending'),
        ));
    }

    /**
     * Kargo Takip Meta Kutusu (Sipariş Detay Sayfası)
     */
    public function add_tracking_meta_box() {
        $screen = class_exists('\Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController') &&
                  \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled()
                  ? wc_get_page_screen_id('shop-order')
                  : 'shop_order';

        add_meta_box(
            'kroptos_tracking_info',
            __('KroptOS Kargo Takip Bilgileri', 'kroptos-connector'),
            array($this, 'render_tracking_meta_box'),
            $screen,
            'side',
            'default'
        );
    }

    public function render_tracking_meta_box($post_or_order_object) {
        $order = ($post_or_order_object instanceof WP_Post) ? wc_get_order($post_or_order_object->ID) : $post_or_order_object;
        if (!$order) return;

        $tracking_number = $order->get_meta('_kroptos_tracking_number');
        $carrier_name    = $order->get_meta('_kroptos_carrier_name');
        $tracking_url    = $order->get_meta('_kroptos_tracking_url');

        if (!empty($tracking_number)) {
            echo '<p><strong>' . esc_html__('Kargo Firması:', 'kroptos-connector') . '</strong> ' . esc_html($carrier_name ?: 'Belirtilmedi') . '</p>';
            echo '<p><strong>' . esc_html__('Takip Numarası:', 'kroptos-connector') . '</strong> <code>' . esc_html($tracking_number) . '</code></p>';
            if (!empty($tracking_url)) {
                echo '<p><a href="' . esc_url($tracking_url) . '" target="_blank" class="button button-secondary">' . esc_html__('Kargoyu Takip Et', 'kroptos-connector') . '</a></p>';
            }
        } else {
            echo '<p style="color:#777;"><em>' . esc_html__('Henüz KroptOS üzerinden kargo barkodu/takip numarası iletilmedi.', 'kroptos-connector') . '</em></p>';
        }
    }

    /**
     * Müşteriye Kargo Takip Bilgisini Göster
     */
    public function display_tracking_to_customer($order) {
        if (!$order) return;

        $tracking_number = $order->get_meta('_kroptos_tracking_number');
        $carrier_name    = $order->get_meta('_kroptos_carrier_name');
        $tracking_url    = $order->get_meta('_kroptos_tracking_url');

        if (!empty($tracking_number)) {
            echo '<section class="woocommerce-customer-details kroptos-tracking-section" style="margin-top:20px; padding:15px; background:#f9f9f9; border-left:4px solid #4f46e5; border-radius:4px;">';
            echo '<h2 style="font-size:18px; margin-top:0;">' . esc_html__('Kargo Takip Bilgileri', 'kroptos-connector') . '</h2>';
            echo '<p><strong>' . esc_html__('Kargo Şirketi:', 'kroptos-connector') . '</strong> ' . esc_html($carrier_name ?: 'Kargo') . '<br/>';
            echo '<strong>' . esc_html__('Takip Numarası:', 'kroptos-connector') . '</strong> ' . esc_html($tracking_number) . '</p>';
            if (!empty($tracking_url)) {
                echo '<p><a href="' . esc_url($tracking_url) . '" target="_blank" style="display:inline-block; padding:8px 16px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:4px;">' . esc_html__('Gönderiyi Canlı Takip Et', 'kroptos-connector') . ' &rarr;</a></p>';
            }
            echo '</section>';
        }
    }

    public function add_settings_page($settings) {
        // WooCommerce Ayarlar sekmesi
        return $settings;
    }
}

KroptOS_Connector::get_instance();
