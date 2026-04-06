import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Popconfirm, message, Tabs, Card, Input, Empty } from 'antd';
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
interface RideSharePartner { id: string; partnerName: string; partnerEENumber: string; }
interface RideShareRow { dealerId: string; dealerName: string; eeNumber: string | null; weekStart: string | null; partners: RideSharePartner[]; createdAt: string; }

const DEFAULT_PAGE_SIZE = 50;

const Requests: React.FC = () => {
  const { weekStartStr } = useWeek();
  const [avails, setAvails] = useState<AvailRow[]>([]);
  const [availTotal, setAvailTotal] = useState(0);
  const [availPage, setAvailPage] = useState(1);
  const [availPageSize, setAvailPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [timeOffs, setTimeOffs] = useState<TimeOffRow[]>([]);
  const [timeOffTotal, setTimeOffTotal] = useState(0);
  const [timeOffPage, setTimeOffPage] = useState(1);
  const [timeOffPageSize, setTimeOffPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [rideShares, setRideShares] = useState<RideShareRow[]>([]);
  const [rideShareTotal, setRideShareTotal] = useState(0);
  const [rideSharePage, setRideSharePage] = useState(1);
  const [rideSharePageSize, setRideSharePageSize] = useState(DEFAULT_PAGE_SIZE);

  const [activeTab, setActiveTab] = useState('availability');
  const [searchId, setSearchId] = useState('');
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [loadingTimeOff, setLoadingTimeOff] = useState(false);
  const [loadingRideShare, setLoadingRideShare] = useState(false);

  const fetchAvails = useCallback(async () => {
    setLoadingAvail(true);
    try {
      const res = await adminRequestsApi.availability(weekStartStr, availPage, availPageSize);
      setAvails(res.data.data as AvailRow[]);
      setAvailTotal(res.data.total);
    } catch {
      message.error('Failed to load availability');
    } finally {
      setLoadingAvail(false);
    }
  }, [weekStartStr, availPage, availPageSize]);

  const fetchTimeOffs = useCallback(async () => {
    setLoadingTimeOff(true);
    try {
      const res = await adminRequestsApi.timeOff(weekStartStr, timeOffPage, timeOffPageSize);
      setTimeOffs(res.data.data as TimeOffRow[]);
      setTimeOffTotal(res.data.total);
    } catch {
      message.error('Failed to load time off');
    } finally {
      setLoadingTimeOff(false);
    }
  }, [weekStartStr, timeOffPage, timeOffPageSize]);

  const fetchRideShares = useCallback(async () => {
    setLoadingRideShare(true);
    try {
      const res = await adminRequestsApi.rideShare(weekStartStr, rideSharePage, rideSharePageSize);
      setRideShares(res.data.data as RideShareRow[]);
      setRideShareTotal(res.data.total);
    } catch {
      message.error('Failed to load ride share');
    } finally {
      setLoadingRideShare(false);
    }
  }, [weekStartStr, rideSharePage, rideSharePageSize]);

  // Reset to page 1 when week changes
  useEffect(() => {
    setAvailPage(1);
    setTimeOffPage(1);
    setRideSharePage(1);
  }, [weekStartStr]);

  useEffect(() => { fetchAvails(); }, [fetchAvails]);
  useEffect(() => { fetchTimeOffs(); }, [fetchTimeOffs]);
  useEffect(() => { fetchRideShares(); }, [fetchRideShares]);

  const filtered = <T extends { dealerId: string; dealerName?: string; eeNumber?: string | null }>(list: T[]) => {
    if (!searchId) return list;
    const s = searchId.toLowerCase();
    return list.filter(r =>
      r.dealerId.toLowerCase().includes(s) ||
      (r.dealerName || '').toLowerCase().includes(s) ||
      (r.eeNumber || '').toLowerCase().includes(s)
    );
  };

  const handleTimeOffAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await timeOffApi.approve(id);
      else await timeOffApi.reject(id);
      message.success(action === 'approve' ? 'Approved' : 'Rejected');
      fetchTimeOffs();
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
      onFilter: (v, r) => r.status === v },
    { title: 'Actions', width: 140, render: (_, r) => r.status !== 'pending' ? null : (
      <div style={{ display: 'flex', gap: 4 }}>
        <Popconfirm title="Approve?" onConfirm={() => handleTimeOffAction(r.id, 'approve')}><Button type="primary" size="small" icon={<CheckOutlined />} /></Popconfirm>
        <Popconfirm title="Reject?" onConfirm={() => handleTimeOffAction(r.id, 'reject')}><Button size="small" danger icon={<CloseOutlined />} /></Popconfirm>
      </div>
    )},
  ];

  const rideShareCols: ColumnsType<RideShareRow> = [
    { title: 'Driver', width: 180, render: (_, r) => (
      <div>
        <div style={{ fontWeight: 500 }}>{r.dealerName || r.dealerId}</div>
        {r.eeNumber && <div style={{ fontSize: 12, color: '#999' }}>EE# {r.eeNumber}</div>}
      </div>
    ), sorter: (a, b) => a.dealerName.localeCompare(b.dealerName) },
    { title: 'Week', dataIndex: 'weekStart', width: 120, render: (v: string | null) => v ? dayjs(v).format('MM/DD') + ' (Fri)' : '-' },
    { title: 'Passengers', dataIndex: 'partners', render: (partners: RideSharePartner[]) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {partners.map(p => (
          <Tag key={p.id} color="purple" style={{ margin: 0 }}>
            {p.partnerName} <span style={{ opacity: 0.7 }}>#{p.partnerEENumber}</span>
          </Tag>
        ))}
      </div>
    )},
    { title: 'Submitted', dataIndex: 'createdAt', width: 150, render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
  ];

  const paginationConfig = (
    current: number, pageSize: number, total: number,
    onChange: (p: number, s: number) => void,
  ) => ({
    current, pageSize, total, showSizeChanger: true,
    pageSizeOptions: ['50', '100', '200'],
    showTotal: (t: number) => `${t} records`,
    onChange,
  });

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <WeekPicker />
        <div style={{ flex: 1 }} />
        <Input.Search placeholder="Search by name or EE Number" allowClear style={{ width: 240 }}
          onSearch={v => setSearchId(v.trim())} onChange={e => { if (!e.target.value) setSearchId(''); }} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #1677ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Availability</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{availTotal}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Time Off</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>{timeOffTotal}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{pendingTimeOff} pending</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #722ed1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CarOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Ride Share</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#722ed1' }}>{rideShareTotal}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'availability', label: `Availability (${availTotal})`,
          children: !loadingAvail && filtered(avails).length === 0
            ? <Empty description="No availability requests" style={{ padding: 60 }} />
            : <Table columns={availCols} dataSource={filtered(avails)} rowKey="id" size="small" loading={loadingAvail}
                pagination={paginationConfig(availPage, availPageSize, availTotal, (p, s) => { setAvailPage(p); setAvailPageSize(s); })} /> },
        { key: 'timeOff', label: `Time Off (${timeOffTotal})`,
          children: !loadingTimeOff && filtered(timeOffs).length === 0
            ? <Empty description="No time off requests" style={{ padding: 60 }} />
            : <Table columns={timeOffCols} dataSource={filtered(timeOffs)} rowKey="id" size="small" loading={loadingTimeOff}
                pagination={paginationConfig(timeOffPage, timeOffPageSize, timeOffTotal, (p, s) => { setTimeOffPage(p); setTimeOffPageSize(s); })} /> },
        { key: 'rideShare', label: `Ride Share (${rideShareTotal})`,
          children: !loadingRideShare && filtered(rideShares).length === 0
            ? <Empty description="No ride share requests" style={{ padding: 60 }} />
            : <Table columns={rideShareCols} dataSource={filtered(rideShares)} rowKey={(r) => `${r.dealerId}-${r.weekStart}`} size="small" loading={loadingRideShare}
                pagination={paginationConfig(rideSharePage, rideSharePageSize, rideShareTotal, (p, s) => { setRideSharePage(p); setRideSharePageSize(s); })} /> },
      ]} />
    </div>
  );
};

export default Requests;
