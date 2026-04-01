import React, { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Button, message, Divider, Space } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { schedulerConfigApi } from '../api/schedulerConfig';

interface ConfigItem {
  key: string;
  value: number;
  label: string;
  description: string | null;
}

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

  const groupedConfigs = {
    demand: configs.filter(c => c.key === 'shortfall_penalty' || c.key === 'overstaff_reward'),
    seniority: configs.filter(c => c.key === 'seniority_max_score'),
    shift: configs.filter(c => c.key === 'shift_pref_match' || c.key === 'shift_pref_mismatch' || c.key === 'shift_flexible_bonus'),
    dayOff: configs.filter(c => c.key === 'preferred_day_off_penalty'),
    rideShare: configs.filter(c => c.key === 'ride_share_mismatch'),
    minShift: configs.filter(c => c.key === 'min_one_shift_reward'),
    fairness: configs.filter(c => c.key === 'fairness_gap_penalty'),
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Scheduler Settings"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset} loading={resetting}>
              Reset to Defaults
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              Save Settings
            </Button>
          </Space>
        }
        loading={loading}
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left">Demand Coverage (S0)</Divider>
          {groupedConfigs.demand.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} />
            </Form.Item>
          ))}

          <Divider orientation="left">Seniority Priority (S1)</Divider>
          {groupedConfigs.seniority.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} min={0} />
            </Form.Item>
          ))}

          <Divider orientation="left">Shift Preference (S2)</Divider>
          {groupedConfigs.shift.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} />
            </Form.Item>
          ))}

          <Divider orientation="left">Preferred Day Off (S3)</Divider>
          {groupedConfigs.dayOff.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} />
            </Form.Item>
          ))}

          <Divider orientation="left">Ride Share Matching (S4)</Divider>
          {groupedConfigs.rideShare.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} />
            </Form.Item>
          ))}

          <Divider orientation="left">Minimum One Shift (S5)</Divider>
          {groupedConfigs.minShift.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} min={0} />
            </Form.Item>
          ))}

          <Divider orientation="left">Fairness (S6)</Divider>
          {groupedConfigs.fairness.map(c => (
            <Form.Item key={c.key} label={c.label} name={c.key} tooltip={c.description}>
              <InputNumber style={{ width: 200 }} />
            </Form.Item>
          ))}
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
