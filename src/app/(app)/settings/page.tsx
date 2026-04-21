'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Plus, X, Shield, Sliders, Tag, CheckCircle2 } from 'lucide-react';

interface ConfigItem {
  key: string;
  value: string[] | { value: number } | string;
  label: string;
  description: string;
}

interface SettingItem {
  key: string;
  value: string;
  label: string;
}

const CARD_STYLE = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title, description, icon: Icon, iconColor, children, delay = 0,
}: {
  title: string; description?: string;
  icon: React.ElementType; iconColor: string;
  children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={CARD_STYLE}
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-start gap-4"
        style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${iconColor}0e`, border: `1px solid ${iconColor}22` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor, width: 18, height: 18 }} />
        </div>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: '#0f172a' }}>{title}</p>
          {description && (
            <p className="text-[12px] mt-0.5" style={{ color: '#94a3b8' }}>{description}</p>
          )}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────
function SaveBtn({
  onClick, loading, saved, disabled,
}: {
  onClick: () => void; loading: boolean; saved: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-50 flex-shrink-0"
      style={{
        background: saved
          ? 'linear-gradient(135deg, #16a34a, #22d3ee)'
          : 'linear-gradient(135deg, #d97706, #b45309)',
        boxShadow: saved ? '0 2px 10px rgba(22,163,74,0.25)' : '0 2px 10px rgba(217,119,6,0.25)',
        minWidth: 80,
      }}
    >
      {saved
        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
        : loading
        ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
        : <><Save className="w-3.5 h-3.5" /> Save</>
      }
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [config, setConfig]   = useState<ConfigItem[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(json => {
        setConfig(json.data?.config || []);
        setSettings(json.data?.settings || []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveConfig(key: string, value: unknown) {
    setSaving(key);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'config', key, value }),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  async function saveSetting(key: string, value: string) {
    setSaving(key);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'setting', key, value }),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  function updateConfigKeyword(cfgKey: string, index: number, newValue: string) {
    setConfig(prev => prev.map(c => {
      if (c.key !== cfgKey) return c;
      const arr = [...(c.value as string[])];
      arr[index] = newValue;
      return { ...c, value: arr };
    }));
  }

  function addConfigKeyword(cfgKey: string) {
    setConfig(prev => prev.map(c => {
      if (c.key !== cfgKey) return c;
      return { ...c, value: [...(c.value as string[]), ''] };
    }));
  }

  function removeConfigKeyword(cfgKey: string, index: number) {
    setConfig(prev => prev.map(c => {
      if (c.key !== cfgKey) return c;
      const arr = [...(c.value as string[])];
      arr.splice(index, 1);
      return { ...c, value: arr };
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <Settings className="w-5 h-5 animate-pulse" style={{ color: '#7c3aed' }} />
          </div>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Loading settings…</p>
        </div>
      </div>
    );
  }

  const keywordConfigs = config.filter(c => Array.isArray(c.value));
  const numericConfigs = config.filter(c => typeof c.value === 'object' && !Array.isArray(c.value) && c.value !== null);

  const inputStyle = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#0f172a',
    borderRadius: '0.625rem',
    fontSize: '13px',
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div className="p-7 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)', boxShadow: '0 2px 10px rgba(124,58,237,0.3)' }}>
            <Settings className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Settings</h1>
        </div>
        <p className="text-sm ml-11" style={{ color: '#64748b' }}>
          Configure screening rules, keywords, and scraping behaviour
        </p>
      </motion.div>

      <div className="space-y-5">

        {/* Scraping Configuration */}
        {settings.length > 0 && (
          <Section
            title="Scraping Configuration"
            description="Tender247 credentials and scrape limits"
            icon={Settings} iconColor="#7c3aed" delay={0}
          >
            <div className="space-y-5">
              {settings.map(setting => (
                <div key={setting.key} className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: '#334155' }}>
                      {setting.label}
                    </label>
                    {setting.key === 'scrape_max_tenders' && (
                      <p className="text-[11px] mb-2" style={{ color: '#94a3b8' }}>
                        Tenders fetched per run. Set 20 for testing, 100–500 for production.
                      </p>
                    )}
                    <input
                      type={setting.key.includes('password') ? 'password' : setting.key === 'scrape_max_tenders' ? 'number' : 'text'}
                      min={setting.key === 'scrape_max_tenders' ? 5 : undefined}
                      max={setting.key === 'scrape_max_tenders' ? 500 : undefined}
                      value={setting.value}
                      onChange={e => setSettings(prev => prev.map(s =>
                        s.key === setting.key ? { ...s, value: e.target.value } : s
                      ))}
                      style={inputStyle}
                      onFocus={e => {
                        e.target.style.borderColor = 'rgba(124,58,237,0.4)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.06)';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div className="mt-[28px]">
                    <SaveBtn
                      onClick={() => saveSetting(setting.key, setting.value)}
                      loading={saving === setting.key}
                      saved={saved === setting.key}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Numeric Thresholds */}
        {numericConfigs.length > 0 && (
          <Section
            title="Value Thresholds"
            description="Minimum / maximum tender value filters for L1 screening"
            icon={Sliders} iconColor="#d97706" delay={0.08}
          >
            <div className="space-y-4">
              {numericConfigs.map(cfg => (
                <div key={cfg.key} className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: '#334155' }}>{cfg.label}</label>
                    {cfg.description && (
                      <p className="text-[11px] mb-2" style={{ color: '#94a3b8' }}>{cfg.description}</p>
                    )}
                    <input
                      type="number"
                      value={(cfg.value as { value: number }).value}
                      onChange={e => setConfig(prev => prev.map(c =>
                        c.key === cfg.key ? { ...c, value: { value: Number(e.target.value) } } : c
                      ))}
                      style={{ ...inputStyle, width: '180px' }}
                      onFocus={e => {
                        e.target.style.borderColor = 'rgba(217,119,6,0.45)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(217,119,6,0.06)';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div className="mt-[28px]">
                    <SaveBtn
                      onClick={() => saveConfig(cfg.key, cfg.value)}
                      loading={saving === cfg.key}
                      saved={saved === cfg.key}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Keyword arrays */}
        {keywordConfigs.map((cfg, i) => (
          <Section
            key={cfg.key}
            title={cfg.label}
            description={cfg.description}
            icon={cfg.key.includes('exclusion') ? Shield : Tag}
            iconColor={cfg.key.includes('exclusion') ? '#dc2626' : '#7c3aed'}
            delay={0.16 + i * 0.06}
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {(cfg.value as string[]).map((kw, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-lg overflow-hidden"
                  style={{
                    background: cfg.key.includes('exclusion') ? 'rgba(239,68,68,0.05)' : 'rgba(124,58,237,0.05)',
                    border: cfg.key.includes('exclusion') ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(124,58,237,0.18)',
                  }}
                >
                  <input
                    className="bg-transparent px-2.5 py-1.5 text-[12px] focus:outline-none min-w-[80px] max-w-[200px]"
                    style={{
                      color: cfg.key.includes('exclusion') ? '#dc2626' : '#7c3aed',
                      caretColor: cfg.key.includes('exclusion') ? '#dc2626' : '#7c3aed',
                    }}
                    value={kw}
                    onChange={e => updateConfigKeyword(cfg.key, idx, e.target.value)}
                  />
                  <button
                    onClick={() => removeConfigKeyword(cfg.key, idx)}
                    className="px-1.5 py-1.5 transition-colors"
                    style={{ color: '#cbd5e1' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Add button */}
              <button
                onClick={() => addConfigKeyword(cfg.key)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', color: '#7c3aed' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; }}
              >
                <Plus className="w-3.5 h-3.5" /> Add keyword
              </button>
            </div>

            <div className="flex justify-end">
              <SaveBtn
                onClick={() => saveConfig(cfg.key, cfg.value)}
                loading={saving === cfg.key}
                saved={saved === cfg.key}
              />
            </div>
          </Section>
        ))}
      </div>
    </div>
  );
}
