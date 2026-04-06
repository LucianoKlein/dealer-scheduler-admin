import React, { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Button, message, Space, Spin } from 'antd';
import {
  SaveOutlined, ReloadOutlined, SettingOutlined, ThunderboltOutlined,
  FieldTimeOutlined, CarOutlined, TeamOutlined, BarChartOutlined, SafetyOutlined,
} from '@ant-design/icons';
import { schedulerConfigApi } from '../api/schedulerConfig';

interface ConfigItem {
  key: string;
  value: number;
  label: string;
  description: string | null;
}

interface GroupDef {
  title: string;
  color: string;
  icon: React.ReactNode;
  keys: string[];
}

const GROUPS: GroupDef[] = [
  { title: 'Demand Coverage (S0)', color: '#1677ff', icon: <ThunderboltOutlined />, keys: ['shortfall_penalty', 'overstaff_reward'] },
  { title: 'Seniority Priority (S1)', color: '#52c41a', icon: <TeamOutlined />, keys: ['seniority_max_score'] },
  { title: 'Shift Preference (S2)', color: '#722ed1', icon: <FieldTimeOutlined />, keys: ['shift_pref_match', 'shift_pref_mismatch', 'shift_flexible_bonus'] },
  { title: 'Preferred Day Off (S3)', color: '#faad14', icon: <BarChartOutlined />, keys: ['preferred_day_off_penalty'] },
  { title: 'Ride Share Matching (S4)', color: '#13c2c2', icon: <CarOutlined />, keys: ['ride_share_mismatch'] },
  { title: 'Minimum One Shift (S5)', color: '#eb2f96', icon: <SafetyOutlined />, keys: ['min_one_shift_reward'] },
  { title: 'Fairness (S6)', color: '#fa541c', icon: <BarChartOutlined />, keys: ['fairness_gap_penalty'] },
];

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await schedulerConfigApi.list();
      setConfigs(res.data);
      const initialValues: Record<string, number> = {};
      res.data.forEach((c: ConfigItem) => {
        initialValues[c.key] = c.value;
      });
      form.setFieldsValue(initialValues);
    } catch {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const updates = Object.keys(values).map(key => ({ key, value: values[key] }));
      await schedulerConfigApi.batchUpdate(updates);
      message.success('Settings saved');
      loadConfigs();
    } catch {
      message.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await schedulerConfigApi.reset();
      message.success('Settings reset to defaults');
      loadConfigs();
    } catch {
      message.error('Failed to reset settings');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined style={{ fontSize: 18, color: '#1677ff' }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>Scheduler Settings</span>
        </div>
        <div style={{ flex: 1 }} />
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset} loading={resetting}>
            Reset to Defaults
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            Save Settings
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #1677ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Total Parameters</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{configs.length}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #52c41a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThunderboltOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Groups</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>{GROUPS.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
            {GROUPS.map(group => {
              const items = configs.filter(c => group.keys.includes(c.key));
              if (items.length === 0) return null;
              return (
                <Card
                  key={group.title}
                  size="small"
                  style={{ borderLeft: `3px solid ${group.color}` }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: group.color, fontSize: 16 }}>{group.icon}</span>
                      <span>{group.title}</span>
                    </div>
                  }
                >
                  {items.map(c => (
                    <Form.Item
                      key={c.key}
                      label={c.label}
                      name={c.key}
                      tooltip={c.description}
                      style={{ marginBottom: 16 }}
                    >
                      <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                  ))}
                </Card>
              );
            })}
          </div>
        </Form>
      )}
    </div>
  );
};

export default Settings;
