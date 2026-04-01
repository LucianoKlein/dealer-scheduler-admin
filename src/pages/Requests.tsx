import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Popconfirm, message, Tabs, Card, Input } from 'antd';
import { CheckOutlined, CloseOutlined, CalendarOutlined, CarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { ShiftType } from '../types';
import { useWeek } from '../contexts/WeekContext';
import WeekPicker from '../components/WeekPicker';
import { adminRequestsApi } from '../api/schedule';
import { timeOffApi } from '../api/timeOff';

const shiftLabels: Record<ShiftType, string> = { day: 'Day Shift', swing: 'Swing Shift', mixed: 'Mixed Game Shift' };
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const statusColor: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' };

interface AvailRow { id: number; dealerId: string; dealerName: string; eeNumber: string | null; weekStart: string; shift: string; preferredDaysOff: number[]; submittedAt: string; }
interface TimeOffRow { id: string; dealerId: string; dealerName: string; eeNumber: string | null; startDate: string; endDate: string; reason: string; status: string; submittedAt: string; }
interface RideShareRow { id: string; dealerId: string; dealerName: string; eeNumber: string | null; partnerName: string; partnerEENumber: string; createdAt: string; }

const Requests: React.FC = () => {
  const { weekStartStr } = useWeek();
  const [avails, setAvails] = useState<AvailRow[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOffRow[]>([]);
  const [rideShares, setRideShares] = useState<RideShareRow[]>([]);
  const [activeTab, setActiveTab] = useState('availability');
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes, rRes] = await Promise.all([
        adminRequestsApi.availability(weekStartStr),
        adminRequestsApi.timeOff(weekStartStr),
        adminRequestsApi.rideShare(),
      ]);
      setAvails(aRes.data as AvailRow[]);
      setTimeOffs(tRes.data as TimeOffRow[]);
      setRideShares(rRes.data as RideShareRow[]);
    } catch {
      message.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [weekStartStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = <T extends { dealerId: string }>(list: T[]) =>
    searchId ? list.filter(r => r.dealerId.includes(searchId)) : list;

  const handleTimeOffAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await timeOffApi.approve(id);
      else await timeOffApi.reject(id);
      message.success(action === 'approve' ? 'Approved' : 'Rejected');
      fetchData();
    } catch {
      message.error('Action failed');
    }
  };

  const pendingTimeOff = timeOffs.filter(r => r.status === 'pending').length;

  const availCols: ColumnsType<AvailRow> = [
    { title: 'Dealer', width: 150, render: (_, r) => r.dealerName || r.dealerId, sorter: (a, b) => a.dealerName.localeCompare(b.dealerName) },
    { title: 'EE Number', dataIndex: 'eeNumber', width: 120 },
    { title: 'Week', dataIndex: 'weekStart', width: 120, render: (v: string) => dayjs(v).format('MM/DD') + ' (Fri)' },
    { title: 'Shift', dataIndex: 'shift', width: 140, render: (v: string) => <Tag color="blue">{shiftLabels[v as ShiftType] || v}</Tag> },
    { title: 'Preferred Days Off', dataIndex: 'preferredDaysOff', width: 160, render: (v: number[]) => v?.length ? v.map(d => <Tag key={d} color="purple">{DAY_LABELS[d]}</Tag>) : '-' },
    { title: 'Submitted', dataIndex: 'submittedAt', width: 150, render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
  ];

  const timeOffCols: ColumnsType<TimeOffRow> = [
    { title: 'Dealer', width: 150, render: (_, r) => r.dealerName || r.dealerId, sorter: (a, b) => a.dealerName.localeCompare(b.dealerName) },
    { title: 'EE Number', dataIndex: 'eeNumber', width: 120 },
    { title: 'Date Range', width: 200, render: (_, r) => `${r.startDate} ~ ${r.endDate}` },
    { title: 'Reason', dataIndex: 'reason', width: 120 },
    { title: 'Submitted', dataIndex: 'submittedAt', width: 150, render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
    { title: 'Status', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={statusColor[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Tag>,
      filters: [{ text: 'Pending', value: 'pending' }, { text: 'Approved', value: 'approved' }, { text: 'Rejected', value: 'rejected' }],
      onFilter: (v, r) => r.status === v, defaultFilteredValue: ['pending'] },
    { title: 'Actions', width: 140, render: (_, r) => r.status !== 'pending' ? null : (
      <div style={{ display: 'flex', gap: 4 }}>
        <Popconfirm title="Approve?" onConfirm={() => handleTimeOffAction(r.id, 'approve')}><Button type="primary" size="small" icon={<CheckOutlined />} /></Popconfirm>
        <Popconfirm title="Reject?" onConfirm={() => handleTimeOffAction(r.id, 'reject')}><Button size="small" danger icon={<CloseOutlined />} /></Popconfirm>
      </div>
    )},
  ];

  const rideShareCols: ColumnsType<RideShareRow> = [
    { title: 'Dealer', width: 150, render: (_, r) => r.dealerName || r.dealerId, sorter: (a, b) => a.dealerName.localeCompare(b.dealerName) },
    { title: 'EE Number', dataIndex: 'eeNumber', width: 120 },
    { title: 'Partner', dataIndex: 'partnerName', width: 150 },
    { title: 'Partner EE', dataIndex: 'partnerEENumber', width: 100 },
    { title: 'Created', dataIndex: 'createdAt', width: 150, render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <WeekPicker />
        <div style={{ flex: 1 }} />
        <Input.Search placeholder="Search by EE Number" allowClear style={{ width: 200 }}
          onSearch={v => setSearchId(v.trim())} onChange={e => { if (!e.target.value) setSearchId(''); }} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #1677ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Availability</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{avails.length}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Time Off</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>{pendingTimeOff}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{pendingTimeOff} pending</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #722ed1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CarOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Ride Share</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#722ed1' }}>{rideShares.length}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'availability', label: `Availability (${avails.length})`,
          children: <Table columns={availCols} dataSource={filtered(avails)} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 15, showSizeChanger: true }} /> },
        { key: 'timeOff', label: `Time Off (${timeOffs.length})`,
          children: <Table columns={timeOffCols} dataSource={filtered(timeOffs)} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 15, showSizeChanger: true }} /> },
        { key: 'rideShare', label: `Ride Share (${rideShares.length})`,
          children: <Table columns={rideShareCols} dataSource={filtered(rideShares)} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 15, showSizeChanger: true }} /> },
      ]} />
    </div>
  );
};

export default Requests;
