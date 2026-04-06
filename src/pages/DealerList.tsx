import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space, Drawer, Form, Tag, Popconfirm, message, Card, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, CalendarOutlined, IdcardOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { dealersApi, DealerDTO } from '../api/dealers';
import { DealerType, Employment } from '../types';

const typeLabel: Record<DealerType, string> = { tournament: 'Tournament', cash: 'Cash Game', restart: 'Restart' };
const empLabel: Record<Employment, string> = { full_time: 'Full Time', part_time: 'Part Time' };

const DealerList: React.FC = () => {
  const [dealers, setDealers] = useState<DealerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<DealerDTO | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<DealerType | ''>('');
  const [filterEmployment, setFilterEmployment] = useState<Employment | ''>('');
  const [form] = Form.useForm();

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dealersApi.list({
        search: searchText || undefined,
        type: filterType || undefined,
        employment: filterEmployment || undefined,
        page,
        size: pageSize,
      });
      setDealers(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load dealers');
    } finally {
      setLoading(false);
    }
  }, [searchText, filterType, filterEmployment, page, pageSize]);

  useEffect(() => { fetchDealers(); }, [fetchDealers]);

  const stats = useMemo(() => ({
    total,
    tournament: dealers.filter(d => d.type === 'tournament').length,
    fullTime: dealers.filter(d => d.employment === 'full_time').length,
  }), [dealers, total]);

  const openDrawer = (dealer?: DealerDTO) => {
    if (dealer) {
      setEditingDealer(dealer);
      form.setFieldsValue({ firstName: dealer.firstName, lastName: dealer.lastName, type: dealer.type, employment: dealer.employment, phone: dealer.phone, email: dealer.email });
    } else {
      setEditingDealer(null);
      form.resetFields();
    }
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingDealer) {
        await dealersApi.update(editingDealer.id, values);
        message.success('Dealer updated');
      } else {
        const newId = `D${String(total + 1).padStart(4, '0')}`;
        await dealersApi.create({ id: newId, ...values });
        message.success('Dealer added');
      }
      setDrawerOpen(false);
      fetchDealers();
    } catch {
      message.error('Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dealersApi.delete(id);
      message.success('Dealer deleted');
      fetchDealers();
    } catch {
      message.error('Delete failed');
    }
  };

  const columns: ColumnsType<DealerDTO> = [
    { title: 'EE Number', dataIndex: 'eeNumber', width: 90, sorter: (a, b) => (a.eeNumber || '').localeCompare(b.eeNumber || '') },
    { title: 'Name', width: 160, render: (_, r) => `${r.firstName} ${r.lastName}`, sorter: (a, b) => a.lastName.localeCompare(b.lastName) },
    {
      title: 'Type', dataIndex: 'type', width: 120,
      render: (tp: DealerType) => {
        const color = tp === 'tournament' ? 'blue' : tp === 'cash' ? 'green' : 'orange';
        return <Tag color={color}>{typeLabel[tp]}</Tag>;
      },
    },
    { title: 'Employment', dataIndex: 'employment', width: 110, render: (e: Employment) => empLabel[e] },
    { title: 'Phone', dataIndex: 'phone', width: 140 },
    {
      title: 'Actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openDrawer(record)} />
          <Popconfirm title="Delete this dealer?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="Search by name or EE Number"
          allowClear
          style={{ width: 240 }}
          onSearch={v => setSearchText(v.trim())}
          onChange={e => { if (!e.target.value) setSearchText(''); }}
        />
        <Select
          placeholder="Filter by type"
          value={filterType || undefined}
          onChange={v => setFilterType(v || '')}
          allowClear
          style={{ width: 160 }}
          options={[
            { value: 'tournament', label: 'Tournament' },
            { value: 'cash', label: 'Cash Game', disabled: true },
            { value: 'restart', label: 'Restart', disabled: true },
          ]}
        />
        <Select
          placeholder="Filter by employment"
          value={filterEmployment || undefined}
          onChange={v => setFilterEmployment(v || '')}
          allowClear
          style={{ width: 160 }}
          options={[
            { value: 'full_time', label: 'Full Time' },
            { value: 'part_time', label: 'Part Time', disabled: true },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
          Add Dealer
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #1677ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Total Dealers</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{stats.total}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Tournament</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>{stats.tournament}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #52c41a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IdcardOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Full Time</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>{stats.fullTime}</div>
            </div>
          </div>
        </Card>
      </div>

      {!loading && dealers.length === 0 ? (
        <Empty description="No dealers found" style={{ padding: 60 }} />
      ) : (
        <Table
          columns={columns}
          dataSource={dealers}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            showTotal: t => `${t} dealers`,
            onChange: (p, s) => { setPage(p); setPageSize(s); },
          }}
        />
      )}

      <Drawer
        title={editingDealer ? 'Edit Dealer' : 'Add Dealer'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="firstName" label="First Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'tournament', label: 'Tournament' },
              { value: 'cash', label: 'Cash Game', disabled: true },
              { value: 'restart', label: 'Restart', disabled: true },
            ]} />
          </Form.Item>
          <Form.Item name="employment" label="Employment" rules={[{ required: true }]}>
            <Select options={[
              { value: 'full_time', label: 'Full Time' },
              { value: 'part_time', label: 'Part Time', disabled: true },
            ]} />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default DealerList;
