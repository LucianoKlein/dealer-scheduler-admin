import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Table, Tabs, Card, Tag, Spin, message, Popover, Button } from 'antd';
import {
  CalendarOutlined, TeamOutlined, ClockCircleOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DealerType } from '../types';
import { useWeek } from '../contexts/WeekContext';
import WeekPicker from '../components/WeekPicker';
import { dealersApi, DealerDTO } from '../api/dealers';
import { scheduleApi } from '../api/schedule';
import { timeOffApi } from '../api/timeOff';

interface ScheduleEntryDTO { dealerId: string; date: string; shift: string; }
interface TimeOffDTO { id: string; dealerId: string; startDate: string; endDate: string; status: string; }
interface AvailDTO { shift: string; preferredDaysOff: number[]; }

const Schedule: React.FC = () => {
  const { weekStart, weekStartStr } = useWeek();
  const [activeTab, setActiveTab] = useState<DealerType>('tournament');
  const [dealers, setDealers] = useState<DealerDTO[]>([]);
  const [entries, setEntries] = useState<ScheduleEntryDTO[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOffDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Lazy-loaded availability cache: dealerId -> AvailDTO | null | 'loading'
  const [availCache, setAvailCache] = useState<Map<string, AvailDTO | null | 'loading'>>(new Map());
  const availCacheRef = useRef(availCache);
  availCacheRef.current = availCache;

  // Reset cache when week changes
  useEffect(() => { setAvailCache(new Map()); }, [weekStartStr]);

  const fetchAvailability = useCallback((dealerId: string) => {
    if (availCacheRef.current.has(dealerId)) return;
    setAvailCache(prev => new Map(prev).set(dealerId, 'loading'));
    dealersApi.availability(dealerId, weekStartStr).then(res => {
      const list = res.data as any[];
      const avail = list.length > 0 ? { shift: list[0].shift, preferredDaysOff: list[0].preferredDaysOff || [] } : null;
      setAvailCache(prev => new Map(prev).set(dealerId, avail));
    }).catch(() => {
      setAvailCache(prev => new Map(prev).set(dealerId, null));
    });
  }, [weekStartStr]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dealerRes, schedRes, toRes] = await Promise.all([
        dealersApi.list({ type: activeTab, size: 10000 }),
        scheduleApi.list({ week_start: weekStartStr, dealer_type: activeTab }),
        timeOffApi.list({ week_start: weekStartStr, status: 'approved' }),
      ]);
      setDealers(dealerRes.data.data);
      const allEntries: ScheduleEntryDTO[] = [];
      (schedRes.data as any[]).forEach((s: any) => {
        if (s.entries) allEntries.push(...s.entries);
      });
      setEntries(allEntries);
      setTimeOffs(toRes.data as TimeOffDTO[]);
    } catch {
      message.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  }, [weekStartStr, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weekDates = useMemo(() => {
    const dates: dayjs.Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(weekStart.add(i, 'day'));
    }
    return dates;
  }, [weekStart]);

  const timeOffSet = useMemo(() => {
    const set = new Set<string>();
    timeOffs.forEach(req => {
      let current = dayjs(req.startDate);
      const end = dayjs(req.endDate);
      while (current.isBefore(end, 'day') || current.isSame(end, 'day')) {
        set.add(`${req.dealerId}_${current.format('YYYY-MM-DD')}`);
        current = current.add(1, 'day');
      }
    });
    return set;
  }, [timeOffs]);

  // Map: dealerId_date -> shift
  const entryMap = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => map.set(`${e.dealerId}_${e.date}`, e.shift || ''));
    return map;
  }, [entries]);

  // Filter dealers: only show dealers that have schedule entries this week
  const filteredDealers = useMemo(() => {
    if (entries.length === 0) return [];
    const scheduledIds = new Set(entries.map(e => e.dealerId));
    return dealers.filter(d => scheduledIds.has(d.id));
  }, [dealers, entries]);

  // Summary stats
  const totalAssigned = entries.length;
  const totalTimeOff = useMemo(() => {
    let count = 0;
    filteredDealers.forEach(d => {
      weekDates.forEach(date => {
        if (timeOffSet.has(`${d.id}_${date.format('YYYY-MM-DD')}`)) count++;
      });
    });
    return count;
  }, [filteredDealers, weekDates, timeOffSet]);

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SHIFT_LABELS: Record<string, string> = { day: 'Day (AM)', swing: 'Swing (PM)', mixed: 'Mixed' };

  const renderDealerPopover = (record: DealerDTO) => {
    const cached = availCache.get(record.id);
    const dealerEntries = entries.filter(e => e.dealerId === record.id);
    const totalDays = dealerEntries.length;
    const shifts = [...new Set(dealerEntries.map(e => e.shift))];

    return (
      <div style={{ minWidth: 200, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          {record.firstName} {record.lastName}
          <span style={{ fontWeight: 400, color: '#999', marginLeft: 8 }}>{record.id}</span>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Employment</div>
          <Tag color={record.employment === 'full_time' ? 'blue' : 'orange'} style={{ margin: 0 }}>
            {record.employment === 'full_time' ? 'Full Time' : 'Part Time'}
          </Tag>
        </div>

        {cached === 'loading' ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}><Spin size="small" /></div>
        ) : cached ? (
          <>
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Shift Preference</div>
              <Tag color="purple" style={{ margin: 0 }}>{SHIFT_LABELS[cached.shift] || cached.shift}</Tag>
            </div>
            {cached.preferredDaysOff.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Preferred Days Off</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {cached.preferredDaysOff.map(d => (
                    <Tag key={d} style={{ margin: 0 }}>{DAY_NAMES[d]}</Tag>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 8, color: '#bfbfbf', fontStyle: 'italic' }}>
            No availability submitted
          </div>
        )}

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6 }}>
          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>This Week</div>
          <span style={{ fontWeight: 600, color: '#389e0d' }}>{totalDays} day{totalDays !== 1 ? 's' : ''}</span>
          {shifts.length > 0 && (
            <span style={{ color: '#666', marginLeft: 6 }}>({shifts.join(' / ')})</span>
          )}
        </div>
      </div>
    );
  };

  // Format time for cell display: "12 PM" -> "12PM", "12:00 PM" -> "12PM"
  const shortTime = (time: string) => {
    // New format: "12 PM"
    const simple = time.match(/^(\d{1,2})\s*(AM|PM)$/i);
    if (simple) return `${simple[1]}${simple[2].toUpperCase()}`;
    // Legacy format: "12:00 PM"
    const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return time;
    const hour = m[1];
    const min = m[2];
    const ampm = m[3].toUpperCase();
    return min === '00' ? `${hour}${ampm}` : `${hour}:${min}${ampm}`;
  };

  const columns = [
    {
      title: 'Last Name',
      key: 'lastName',
      width: 120,
      fixed: 'left' as const,
      render: (_: any, record: DealerDTO) => (
        <Popover
          content={() => renderDealerPopover(record)}
          trigger="hover"
          placement="right"
          onOpenChange={open => { if (open) fetchAvailability(record.id); }}
        >
          <span style={{ cursor: 'pointer', borderBottom: '1px dashed #bfbfbf' }}>{record.lastName}</span>
        </Popover>
      ),
    },
    {
      title: 'First Name',
      key: 'firstName',
      width: 110,
      fixed: 'left' as const,
      render: (_: any, record: DealerDTO) => record.firstName,
    },
    {
      title: 'EE Number',
      dataIndex: 'eeNumber',
      width: 100,
      fixed: 'left' as const,
    },
    ...weekDates.map(date => {
      const dateStr = date.format('YYYY-MM-DD');
      const isWeekend = date.day() === 0 || date.day() === 6;
      return {
        title: (
          <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600 }}>{date.format('ddd')}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{date.format('M/D')}</div>
          </div>
        ),
        width: 80,
        align: 'center' as const,
        onHeaderCell: () => ({
          style: { background: isWeekend ? '#fff7e6' : undefined },
        }),
        render: (_: any, record: DealerDTO) => {
          const key = `${record.id}_${dateStr}`;
          const isTimeOff = timeOffSet.has(key);
          const assignedTime = entryMap.get(key);

          if (isTimeOff) {
            return (
              <div style={{
                background: '#fff1f0', color: '#cf1322', fontWeight: 700,
                borderRadius: 4, padding: '2px 0', fontSize: 13,
              }}>X</div>
            );
          }
          if (assignedTime) {
            return (
              <div style={{
                background: '#f6ffed', color: '#389e0d', fontWeight: 600,
                borderRadius: 4, padding: '2px 0', fontSize: 12,
              }}>{shortTime(assignedTime)}</div>
            );
          }
          return (
            <div style={{
              color: '#bfbfbf', fontSize: 11,
            }}>OFF</div>
          );
        },
      };
    }),
  ];

  const tabItems = [
    { key: 'tournament', label: `Tournament (${filteredDealers.length})` },
    { key: 'cash', label: 'Cash Game', disabled: true },
    { key: 'restart', label: 'Restart', disabled: true },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        marginBottom: 16, display: 'flex', gap: 12,
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <WeekPicker />
        <div style={{ flex: 1 }} />
        {entries.length > 0 && (
          <Button
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                const res = await scheduleApi.downloadExcel(weekStartStr, activeTab);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `schedule_${activeTab}_${weekStartStr}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch {
                message.error('Failed to download Excel');
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? 'Generating...' : 'Download Excel'}
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #1677ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Assigned</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{totalAssigned}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #52c41a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Dealers</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>{filteredDealers.length}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Time Off</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>{totalTimeOff}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as DealerType)}
        items={tabItems}
      />

      <Table
        columns={columns}
        dataSource={filteredDealers}
        rowKey="id"
        size="small"
        loading={loading}
        scroll={{ x: 330 + weekDates.length * 80, y: 600 }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['50', '100', '200'], showTotal: t => `${t} dealers` }}
      />
    </div>
  );
};

export default Schedule;
