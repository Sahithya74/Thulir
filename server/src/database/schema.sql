-- Thulir — MySQL 8 schema (InnoDB, utf8mb4).
--
-- STATUS: written and statically checked (parsed, foreign keys cross-referenced) by src/database/schema.test.ts.
-- It has NOT been executed against a running MySQL server in this prototype; the app runs on in-memory repositories.
--
-- Conventions
--   * Money is stored as integer paise (BIGINT). Never floating point.
--   * Expiry lives on product_batches, never on products: one product can have several batches with different dates.
--   * Eligibility is DERIVED (by the shared engine) from batches + policy. product_eligibility_cache is a cache only.
--   * audit_logs and inventory_movements are append-only: the application never updates or deletes them.

CREATE TABLE towns (
  id            VARCHAR(64)  NOT NULL,
  name_en       VARCHAR(120) NOT NULL,
  name_ta       VARCHAR(120) NOT NULL DEFAULT '',
  district_en   VARCHAR(120) NOT NULL,
  district_ta   VARCHAR(120) NOT NULL DEFAULT '',
  center_lat    DECIMAL(9,6) NOT NULL,
  center_lng    DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE areas (
  id        VARCHAR(64)  NOT NULL,
  town_id   VARCHAR(64)  NOT NULL,
  name_en   VARCHAR(120) NOT NULL,
  name_ta   VARCHAR(120) NOT NULL DEFAULT '',
  lat       DECIMAL(9,6) NOT NULL,
  lng       DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_areas_town (town_id),
  CONSTRAINT fk_areas_town FOREIGN KEY (town_id) REFERENCES towns (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE delivery_zones (
  id          VARCHAR(64) NOT NULL,
  town_id     VARCHAR(64) NOT NULL,
  pincode     CHAR(6)     NOT NULL,
  serviceable TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_zone_town_pincode (town_id, pincode),
  CONSTRAINT fk_zones_town FOREIGN KEY (town_id) REFERENCES towns (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id             VARCHAR(64)  NOT NULL,
  role           ENUM('customer','store_owner','delivery_partner','admin') NOT NULL,
  email          VARCHAR(190) NOT NULL,
  phone          CHAR(10)     NULL,
  name           VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  status         ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at     DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_profiles (
  user_id        VARCHAR(64) NOT NULL,
  preferred_lang ENUM('en','ta') NOT NULL DEFAULT 'en',
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE addresses (
  id         VARCHAR(64)  NOT NULL,
  user_id    VARCHAR(64)  NOT NULL,
  label      ENUM('home','work','other') NOT NULL DEFAULT 'home',
  line1      VARCHAR(80)  NOT NULL,
  area_id    VARCHAR(64)  NOT NULL,
  pincode    CHAR(6)      NOT NULL,
  is_default TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_addresses_area FOREIGN KEY (area_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stores (
  id                         VARCHAR(64)  NOT NULL,
  slug                       VARCHAR(120) NOT NULL,
  town_id                    VARCHAR(64)  NOT NULL,
  name_en                    VARCHAR(120) NOT NULL,
  name_ta                    VARCHAR(120) NOT NULL DEFAULT '',
  category                   ENUM('supermarket','provision','fruit_veg','bakery','dairy','household') NOT NULL,
  tagline_en                 VARCHAR(200) NOT NULL DEFAULT '',
  tagline_ta                 VARCHAR(200) NOT NULL DEFAULT '',
  lat                        DECIMAL(9,6) NOT NULL,
  lng                        DECIMAL(9,6) NOT NULL,
  delivery_radius_m          INT          NOT NULL,
  prep_min                   INT          NOT NULL,
  opens                      CHAR(5)      NOT NULL,
  closes                     CHAR(5)      NOT NULL,
  delivery_fee_paise         BIGINT       NOT NULL,
  free_delivery_above_paise  BIGINT       NOT NULL,
  status                     ENUM('active','suspended','pending') NOT NULL DEFAULT 'pending',
  is_demo                    TINYINT(1)   NOT NULL DEFAULT 0,
  rating_cache               DECIMAL(2,1) NULL,
  review_count_cache         INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stores_slug (slug),
  KEY idx_stores_town (town_id),
  CONSTRAINT fk_stores_town FOREIGN KEY (town_id) REFERENCES towns (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE store_owners (
  store_id VARCHAR(64) NOT NULL,
  user_id  VARCHAR(64) NOT NULL,
  PRIMARY KEY (store_id, user_id),
  KEY idx_store_owners_user (user_id),
  CONSTRAINT fk_store_owners_store FOREIGN KEY (store_id) REFERENCES stores (id),
  CONSTRAINT fk_store_owners_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE store_verifications (
  id           VARCHAR(64)  NOT NULL,
  store_id     VARCHAR(64)  NOT NULL,
  method       VARCHAR(60)  NOT NULL,
  status       ENUM('demo','pending','verified','rejected','suspended') NOT NULL,
  reviewed_by  VARCHAR(64)  NULL,
  notes        VARCHAR(500) NULL,
  created_at   DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_verifications_store (store_id),
  CONSTRAINT fk_verifications_store FOREIGN KEY (store_id) REFERENCES stores (id),
  CONSTRAINT fk_verifications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  id         VARCHAR(40)  NOT NULL,
  parent_id  VARCHAR(40)  NULL,
  name_en    VARCHAR(80)  NOT NULL,
  name_ta    VARCHAR(80)  NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id                   VARCHAR(64)  NOT NULL,
  store_id             VARCHAR(64)  NOT NULL,
  category_id          VARCHAR(40)  NOT NULL,
  name_en              VARCHAR(80)  NOT NULL,
  name_ta              VARCHAR(80)  NOT NULL DEFAULT '',
  brand                VARCHAR(40)  NOT NULL,
  unit                 VARCHAR(20)  NOT NULL,
  price_paise          BIGINT       NOT NULL,
  mrp_paise            BIGINT       NOT NULL,
  description          VARCHAR(300) NOT NULL DEFAULT '',
  shape                ENUM('box','bottle','pouch','jar','crate','carton','tub','bar') NOT NULL,
  color                CHAR(7)      NOT NULL,
  image_url            VARCHAR(200) NULL,
  veg                  TINYINT(1)   NOT NULL DEFAULT 1,
  requires_expiry      TINYINT(1)   NOT NULL DEFAULT 1,
  available            TINYINT(1)   NOT NULL DEFAULT 1,
  flagged_for_removal  TINYINT(1)   NOT NULL DEFAULT 0,
  is_new               TINYINT(1)   NOT NULL DEFAULT 0,
  created_at           DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_products_store (store_id),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores (id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_tags (
  product_id VARCHAR(64) NOT NULL,
  tag        VARCHAR(20) NOT NULL,
  PRIMARY KEY (product_id, tag),
  CONSTRAINT fk_tags_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_search_terms (
  id            BIGINT      NOT NULL AUTO_INCREMENT,
  product_id    VARCHAR(64) NOT NULL,
  term          VARCHAR(80) NOT NULL,
  lang          ENUM('en','ta','translit') NOT NULL,
  PRIMARY KEY (id),
  KEY idx_search_term (term),
  CONSTRAINT fk_search_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_batches (
  id           VARCHAR(80) NOT NULL,
  product_id   VARCHAR(64) NOT NULL,
  batch_no     VARCHAR(30) NOT NULL,
  qty_on_hand  INT         NOT NULL,
  expiry_date  VARCHAR(10) NULL,
  status       ENUM('active','blocked','removed') NOT NULL DEFAULT 'active',
  received_at  DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_batch_no (product_id, batch_no),
  KEY idx_batches_expiry (expiry_date),
  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_movements (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  batch_id   VARCHAR(80)  NOT NULL,
  delta      INT          NOT NULL,
  reason     ENUM('order_reserve','order_release','owner_receive','owner_adjust') NOT NULL,
  ref        VARCHAR(64)  NOT NULL,
  note       VARCHAR(300) NULL,
  at         DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_movements_batch (batch_id),
  CONSTRAINT fk_movements_batch FOREIGN KEY (batch_id) REFERENCES product_batches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE expiry_policies (
  id                    BIGINT      NOT NULL AUTO_INCREMENT,
  scope                 ENUM('platform','department','store_department','product') NOT NULL,
  store_id              VARCHAR(64) NULL,
  department            ENUM('fresh','pantry','chilled','household','personal_care','snacks','beverages','bakery') NULL,
  product_id            VARCHAR(64) NULL,
  near_expiry_days      INT         NULL,
  sell_near_expiry      TINYINT(1)  NULL,
  block_on_expiry_day   TINYINT(1)  NULL,
  low_stock_at          INT         NULL,
  updated_by            VARCHAR(64) NULL,
  updated_at            DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_policy_scope (scope, store_id, department, product_id),
  CONSTRAINT fk_policies_store FOREIGN KEY (store_id) REFERENCES stores (id),
  CONSTRAINT fk_policies_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_policies_user FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_eligibility_cache (
  product_id    VARCHAR(64) NOT NULL,
  status        ENUM('eligible','low_stock','near_expiry','expired','blocked','out_of_stock','requires_review') NOT NULL,
  sellable_qty  INT         NOT NULL,
  reasons       JSON        NOT NULL,
  computed_at   DATETIME(3) NOT NULL,
  PRIMARY KEY (product_id),
  CONSTRAINT fk_eligcache_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE offers (
  id                     VARCHAR(40)  NOT NULL,
  store_id               VARCHAR(64)  NOT NULL,
  kind                   ENUM('percent','flat','free_delivery') NOT NULL,
  label_en               VARCHAR(120) NOT NULL,
  label_ta               VARCHAR(120) NOT NULL DEFAULT '',
  percent                INT          NULL,
  flat_paise             BIGINT       NULL,
  min_subtotal_paise     BIGINT       NULL,
  applies_to_tag         VARCHAR(20)  NULL,
  applies_to_department  VARCHAR(20)  NULL,
  active                 TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_offers_store (store_id),
  CONSTRAINT fk_offers_store FOREIGN KEY (store_id) REFERENCES stores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE carts (
  id          VARCHAR(64) NOT NULL,
  user_id     VARCHAR(64) NOT NULL,
  updated_at  DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_user (user_id),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cart_items (
  cart_id     VARCHAR(64) NOT NULL,
  product_id  VARCHAR(64) NOT NULL,
  qty         INT         NOT NULL,
  PRIMARY KEY (cart_id, product_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id),
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id                       VARCHAR(16)   NOT NULL,
  customer_user_id         VARCHAR(64)   NULL,
  owner_token_hash         CHAR(64)      NULL,
  idempotency_key          VARCHAR(64)   NOT NULL,
  request_fingerprint      VARCHAR(2000) NOT NULL,
  status                   ENUM('awaiting_payment','confirmed','cancelled') NOT NULL,
  cancel_reason            VARCHAR(60)   NULL,
  reservation_expires_at   DATETIME(3)   NULL,
  ship_name                VARCHAR(60)   NOT NULL,
  ship_phone               CHAR(10)      NOT NULL,
  ship_line1               VARCHAR(80)   NOT NULL,
  ship_area_id             VARCHAR(64)   NOT NULL,
  ship_pincode             CHAR(6)       NOT NULL,
  ship_instructions        VARCHAR(200)  NOT NULL DEFAULT '',
  slot_kind                ENUM('asap','window') NOT NULL,
  slot_start_hour          TINYINT       NULL,
  subtotal_paise           BIGINT        NOT NULL,
  discount_paise           BIGINT        NOT NULL,
  delivery_paise           BIGINT        NOT NULL,
  tax_paise                BIGINT        NOT NULL DEFAULT 0,
  total_paise              BIGINT        NOT NULL,
  created_at               DATETIME(3)   NOT NULL,
  confirmed_at             DATETIME(3)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_idempotency (owner_token_hash, idempotency_key),
  KEY idx_orders_customer (customer_user_id),
  KEY idx_orders_status (status, reservation_expires_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_user_id) REFERENCES users (id),
  CONSTRAINT fk_orders_area FOREIGN KEY (ship_area_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE store_orders (
  id                       VARCHAR(20)  NOT NULL,
  order_id                 VARCHAR(16)  NOT NULL,
  store_id                 VARCHAR(64)  NOT NULL,
  status                   ENUM('placed','accepted','rejected','preparing','ready','handed_over','out_for_delivery','delivered','cancelled') NOT NULL,
  reject_reason            VARCHAR(300) NULL,
  refund_simulated_paise   BIGINT       NOT NULL DEFAULT 0,
  subtotal_paise           BIGINT       NOT NULL,
  offer_discount_paise     BIGINT       NOT NULL,
  delivery_fee_paise       BIGINT       NOT NULL,
  total_paise              BIGINT       NOT NULL,
  eta_min                  INT          NOT NULL,
  PRIMARY KEY (id),
  KEY idx_store_orders_order (order_id),
  KEY idx_store_orders_store_status (store_id, status),
  CONSTRAINT fk_store_orders_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_store_orders_store FOREIGN KEY (store_id) REFERENCES stores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id              BIGINT      NOT NULL AUTO_INCREMENT,
  store_order_id  VARCHAR(20) NOT NULL,
  product_id      VARCHAR(64) NOT NULL,
  name_en         VARCHAR(80) NOT NULL,
  name_ta         VARCHAR(80) NOT NULL DEFAULT '',
  brand           VARCHAR(40) NOT NULL,
  unit            VARCHAR(20) NOT NULL,
  price_paise     BIGINT      NOT NULL,
  mrp_paise       BIGINT      NOT NULL,
  qty             INT         NOT NULL,
  PRIMARY KEY (id),
  KEY idx_items_store_order (store_order_id),
  CONSTRAINT fk_items_store_order FOREIGN KEY (store_order_id) REFERENCES store_orders (id),
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item_allocations (
  order_item_id  BIGINT      NOT NULL,
  batch_id       VARCHAR(80) NOT NULL,
  qty            INT         NOT NULL,
  PRIMARY KEY (order_item_id, batch_id),
  CONSTRAINT fk_alloc_item FOREIGN KEY (order_item_id) REFERENCES order_items (id),
  CONSTRAINT fk_alloc_batch FOREIGN KEY (batch_id) REFERENCES product_batches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE store_order_status_history (
  id              BIGINT      NOT NULL AUTO_INCREMENT,
  store_order_id  VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL,
  actor           ENUM('customer','store','delivery','admin','system') NOT NULL,
  actor_user_id   VARCHAR(64) NULL,
  at              DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_history_store_order (store_order_id),
  CONSTRAINT fk_history_store_order FOREIGN KEY (store_order_id) REFERENCES store_orders (id),
  CONSTRAINT fk_history_user FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payments (
  id            VARCHAR(64) NOT NULL,
  order_id      VARCHAR(16) NOT NULL,
  method        ENUM('cod','upi_sim','online_sim') NOT NULL,
  simulated     TINYINT(1)  NOT NULL,
  status        ENUM('cod_pending','awaiting_payment','paid_simulated','failed','void') NOT NULL,
  amount_paise  BIGINT      NOT NULL,
  provider_ref  VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_attempts (
  id          BIGINT      NOT NULL AUTO_INCREMENT,
  payment_id  VARCHAR(64) NOT NULL,
  outcome     ENUM('initiated','success','failure') NOT NULL,
  at          DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_attempts_payment (payment_id),
  CONSTRAINT fk_attempts_payment FOREIGN KEY (payment_id) REFERENCES payments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE delivery_partners (
  user_id     VARCHAR(64) NOT NULL,
  vehicle     VARCHAR(40) NOT NULL,
  town_id     VARCHAR(64) NOT NULL,
  available   TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_partners_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_partners_town FOREIGN KEY (town_id) REFERENCES towns (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE delivery_assignments (
  id               BIGINT      NOT NULL AUTO_INCREMENT,
  store_order_id   VARCHAR(20) NOT NULL,
  partner_user_id  VARCHAR(64) NOT NULL,
  assigned_at      DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_store_order (store_order_id),
  CONSTRAINT fk_assign_store_order FOREIGN KEY (store_order_id) REFERENCES store_orders (id),
  CONSTRAINT fk_assign_partner FOREIGN KEY (partner_user_id) REFERENCES delivery_partners (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reviews (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  store_id    VARCHAR(64)  NOT NULL,
  user_id     VARCHAR(64)  NOT NULL,
  order_id    VARCHAR(16)  NOT NULL,
  rating      TINYINT      NOT NULL,
  body        VARCHAR(600) NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_order_store (order_id, store_id),
  CONSTRAINT fk_reviews_store FOREIGN KEY (store_id) REFERENCES stores (id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id          VARCHAR(20)  NOT NULL,
  store_id    VARCHAR(64)  NOT NULL,
  kind        ENUM('expiry','stock','order') NOT NULL,
  severity    ENUM('critical','warning','info') NOT NULL,
  title       VARCHAR(160) NOT NULL,
  body        VARCHAR(800) NOT NULL,
  product_id  VARCHAR(64)  NULL,
  order_id    VARCHAR(16)  NULL,
  dedupe_key  VARCHAR(255) NOT NULL,
  created_at  DATETIME(3)  NOT NULL,
  read_at     DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_dedupe (store_id, dedupe_key),
  KEY idx_notifications_store (store_id, created_at),
  CONSTRAINT fk_notifications_store FOREIGN KEY (store_id) REFERENCES stores (id),
  CONSTRAINT fk_notifications_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_notifications_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification_deliveries (
  notification_id  VARCHAR(20) NOT NULL,
  channel          ENUM('in_app','email','sms','whatsapp') NOT NULL,
  status           ENUM('delivered','not_configured','failed') NOT NULL,
  at               DATETIME(3) NOT NULL,
  PRIMARY KEY (notification_id, channel),
  CONSTRAINT fk_deliveries_notification FOREIGN KEY (notification_id) REFERENCES notifications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id           VARCHAR(20)  NOT NULL,
  at           DATETIME(3)  NOT NULL,
  actor_id     VARCHAR(64)  NOT NULL,
  actor_name   VARCHAR(120) NOT NULL,
  actor_role   ENUM('customer','store_owner','delivery_partner','admin','system') NOT NULL,
  store_id     VARCHAR(64)  NULL,
  action       VARCHAR(60)  NOT NULL,
  entity_type  VARCHAR(40)  NOT NULL,
  entity_id    VARCHAR(80)  NOT NULL,
  summary      VARCHAR(300) NOT NULL,
  reason       VARCHAR(300) NULL,
  before_json  JSON         NULL,
  after_json   JSON         NULL,
  PRIMARY KEY (id),
  KEY idx_audit_store_at (store_id, at),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_store FOREIGN KEY (store_id) REFERENCES stores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admin_settings (
  setting_key    VARCHAR(80) NOT NULL,
  setting_value  JSON        NOT NULL,
  updated_by     VARCHAR(64) NULL,
  updated_at     DATETIME(3) NOT NULL,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
