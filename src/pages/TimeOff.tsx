import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table, Button, DatePicker, Input, Select, Modal, Form, message, Popconfirm, Card,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CalendarOutlined, ClockCircleOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useWeek } from '../contexts/WeekContext';
import WeekPicker from '../components/WeekPicker';
import { timeOffApi } from '../api/timeOff';
import { dealersApi } from '../api/dealers';

const { RangePicker } = DatePicker;

interface TimeOffRow { id: string; dealerId: string; startDate: string; endDate: string; reason: string; status: string; submittedAt: string; }

const TimeOff: React.FC = () => {
  const { weekStartStr } = useWeek();
  const [requests, setRequests] = useState<TimeOffRow[]>([]);
  const [dealerOptions, setDealerOptions] = useState<{ value: string; label: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timeOffApi.list({ week_start: weekStartStr });
      setRequests(res.data as TimeOffRow[]);
    } catch {
      message.error('Failed to load time off requests');
    } finally {
      setLoading(false);
    }
  }, [weekStartStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    dealersApi.list({ size: 200 }).then(res => {
      setDealerOptions(res.data.data.map(d => ({ value: d.id, label: `${d.firstName} ${d.lastName} (${d.id})` })));
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!searchText) return requests;
    const s = searchText.toLowerCase();
    return requests.filter(r => r.dealerId.toLowerCase().includes(s));
  }, [requests, searchText]);

  const uniqueDealers = useMemo(() => new Set(filtered.map(r => r.dealerId)).size, [filtered]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      const [start, end] = values.dateRange;
      await timeOffApi.create({
        dealerId: values.dealerId,
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        reason: values.reason,
      });
      message.success('Time off request added');
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch {
      message.error('Failed to add request');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timeOffApi.delete(id);
      message.success('Deleted');
      fetchData();
    } catch {
      message.error('Delete failed');
    }
  };

  const columns: ColumnsType<TimeOffRow> = [
    { title: 'EE Number', dataIndex: 'dealerId', width: 100 },
    { title: 'Start Date', dataIndex: 'startDate', width: 120, sorter: (a, b) => a.startDate.localeCompare(b.startDate) },
    { title: 'End Date', dataIndex: 'endDate', width: 120 },
    { title: 'Reason', dataIndex: 'reason', width: 140 },
    { title: 'Status', dataIndex: 'status', width: 100 },
    {
      title: 'Actions', width: 80,
      render: (_, record) => record.status !== 'pending' ? null : (
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <WeekPicker />
        <div style={{ flex: 1 }} />
        <Input.Search
          placeholder="Search by EE Number"
          allowClear
          style={{ width: 220 }}
          onSearch={v => setSearchText(v.trim())}
          onChange={e => { if (!e.target.value) setSearchText(''); }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Add Time Off
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #1677ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Total Requests</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{filtered.length}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>This Week</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>{filtered.length}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #52c41a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Dealers</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>{uniqueDealers}</div>
            </div>
          </div>
        </Card>
      </div>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title="Add Time Off Request"
        open={modalOpen}
        onOk={handleAdd}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Add"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="dealerId" label="Dealer" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select dealer"
              optionFilterProp="label"
              options={dealerOptions}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Select
              allowClear
              options={[
                { value: 'Personal', label: 'Personal' },
                { value: 'Medical', label: 'Medical' },
                { value: 'Family', label: 'Family' },
                { value: 'Vacation', label: 'Vacation' },
                { value: 'Other', label: 'Other' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TimeOff;
