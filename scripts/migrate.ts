import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

const DB_NAME = process.env.DB_DATABASE || 'tender_trakr';

const MIGRATIONS_UP = `
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`${DB_NAME}\`;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  role ENUM('admin', 'manager', 'viewer') NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Scrape runs
CREATE TABLE IF NOT EXISTS scrape_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session ENUM('morning', 'afternoon', 'live', 'manual') NOT NULL DEFAULT 'manual',
  status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
  total_found INT NOT NULL DEFAULT 0,
  total_qualified INT NOT NULL DEFAULT 0,
  total_rejected INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

-- Tenders
CREATE TABLE IF NOT EXISTS tenders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scrape_run_id INT,
  title TEXT NOT NULL,
  tender_no VARCHAR(255) NOT NULL,
  issued_by TEXT NOT NULL,
  estimated_value BIGINT NULL,
  estimated_value_raw VARCHAR(255),
  due_date DATE NULL,
  published_date DATE NULL,
  location VARCHAR(500),
  category VARCHAR(500),
  detail_url TEXT,
  source_session ENUM('morning', 'afternoon', 'live', 'manual') DEFAULT 'manual',

  -- Level 1 auto-screening
  l1_status ENUM('pending', 'qualified', 'rejected') NOT NULL DEFAULT 'pending',
  l1_qualification_reasons JSON,
  l1_exclusion_reason TEXT,

  -- Level 1 human decision
  l1_decision ENUM('accepted', 'rejected', 'pending') NOT NULL DEFAULT 'pending',
  l1_decision_reason TEXT,
  l1_decision_by VARCHAR(255),
  l1_decision_at TIMESTAMP NULL,

  -- Level 2
  l2_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
  l2_analysis JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (scrape_run_id) REFERENCES scrape_runs(id) ON DELETE SET NULL,
  INDEX idx_l1_status (l1_status),
  INDEX idx_l1_decision (l1_decision),
  INDEX idx_due_date (due_date),
  INDEX idx_tender_no (tender_no),
  INDEX idx_issued_by (issued_by(100))
);

-- Screening configuration (DB-driven, editable from UI)
CREATE TABLE IF NOT EXISTS screening_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSON NOT NULL,
  label VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default screening config
INSERT IGNORE INTO screening_config (config_key, config_value, label, description) VALUES
('qualify_keywords', JSON_ARRAY(
  'Multimodal','Intermodal','Container','RCR','Rail Cum Road','GPWIS','LSFTO',
  'Freight Forwarding','Ocean Freight','CHA','Barge','Vessel','Rakes',
  'Rake Management','Terminal Management','MMLP','GatiShakti Cargo Terminal',
  'Port','Berth','Charter Vessel'
), 'Qualification Keywords', 'Tenders matching any of these keywords will be qualified'),
('key_authorities', JSON_ARRAY(
  'NTPC','IOCL','HPCL','BPCL','Railways','NMDC','SAIL','Jindal','Tata','Maruti',
  'Indian Army','Balmer and Lawrie','Balmer Lawrie','RINL','IIT','NFL','IFFCO',
  'APGENCO','Port Authorities','Shipping Corporation','Goa Shipyard'
), 'Key Authorities', 'Tenders from these authorities are prioritized'),
('key_commodities', JSON_ARRAY(
  'Limestone','Calcium Carbonate','Bitumen','Steel Products','Hot Rolled Coils',
  'Cold Rolled Coils','Grains','Bauxite','Manganese Ore','Rock Phosphate',
  'Rake Handling','Wood','Tyres','Edible Oil'
), 'Key Commodities', 'Tenders related to these commodities are of interest'),
('exclude_organizations', JSON_ARRAY(
  'Food Corporation of India','FCI','State Civil Supplies'
), 'Exclude Organizations', 'Exclude tenders from these organizations unless exceptions apply'),
('exclude_categories', JSON_ARRAY(
  'Solid Waste','Waste Management','EPC','Supply Fabrication','Tank Truck'
), 'Exclude Categories', 'Exclude tenders matching these categories'),
('min_value_lakhs', JSON_OBJECT('value', 50), 'Minimum Value (Lakhs)', 'Tenders below this value in Lakhs INR are excluded'),
('high_value_crores', JSON_OBJECT('value', 5), 'High Value Threshold (Crores)', 'Tenders above this value bypass some exclusion rules');

-- Scrape settings
CREATE TABLE IF NOT EXISTS scrape_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  label VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO scrape_settings (setting_key, setting_value, label) VALUES
('tender247_email', 'ashutosh.jha@glasswing.in', 'Tender247 Login Email'),
('tender247_password', 'BDlGRT1N9d', 'Tender247 Login Password'),
('scrape_cron_morning', '0 6 * * *', 'Morning Scrape Cron (default 6am)'),
('scrape_cron_afternoon', '0 13 * * *', 'Afternoon Scrape Cron (default 1pm)'),
('scrape_enabled', 'true', 'Scraping Enabled');
`;

const MIGRATIONS_DOWN = `
USE \`${DB_NAME}\`;
DROP TABLE IF EXISTS tenders;
DROP TABLE IF EXISTS scrape_runs;
DROP TABLE IF EXISTS screening_config;
DROP TABLE IF EXISTS scrape_settings;
DROP TABLE IF EXISTS users;
`;

async function migrate(direction: 'up' | 'down') {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    console.log(`Running migration: ${direction}`);
    const sql = direction === 'up' ? MIGRATIONS_UP : MIGRATIONS_DOWN;
    await conn.query(sql);
    console.log(`Migration ${direction} completed successfully.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

const direction = (process.argv[2] as 'up' | 'down') || 'up';
migrate(direction);
