import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Table, Tabs, Card, Tag, Spin, message, Popover, Popconfirm, Button, Tooltip, Input, Empty, Select } from 'antd';
import {
  CalendarOutlined, TeamOutlined, ClockCircleOutlined, DownloadOutlined, DeleteOutlined,
  WarningOutlined, SortAscendingOutlined, SortDescendingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DealerType } from '../types';
import { useWeek } from '../contexts/WeekContext';
import WeekPicker from '../components/WeekPicker';
import { dealersApi, DealerDTO } from '../api/dealers';
import { scheduleApi, adminRequestsApi } from '../api/schedule';
import { timeOffApi } from '../api/timeOff';
import { projectionApi } from '../api/projection';

interface ScheduleEntryDTO { dealerId: string; date: string; shift: string; }
interface TimeOffDTO { id: string; dealerId: string; startDate: string; endDate: string; status: string; }
interface AvailDTO { shift: string; preferredDaysOff: number[]; }

const Schedule: React.FC = () => {
  const { weekStart, weekStartStr, weekEndStr } = useWeek();
  const [activeTab, setActiveTab] = useState<DealerType>('tournament');
  const [dealers, setDealers] = useState<DealerDTO[]>([]);
  const [entries, setEntries] = useState<ScheduleEntryDTO[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOffDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchText, setSearchText] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string | null>(null);
  const [eeSortOrder, setEeSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [projectionData, setProjectionData] = useState<{ date: string; slots: { time: string; dealersNeeded: number }[] }[]>([]);

  // Batch-loaded availability map: dealerId -> AvailDTO
  const [availMap, setAvailMap] = useState<Map<string, AvailDTO>>(new Map());

  // Lazy-loaded availability cache for popover (dealers not in batch result)
  const [availCache, setAvailCache] = useState<Map<string, AvailDTO | null | 'loading'>>(new Map());
  const availCacheRef = useRef(availCache);
  availCacheRef.current = availCache;

  // Reset cache when week changes
  useEffect(() => { setAvailCache(new Map()); setAvailMap(new Map()); }, [weekStartStr]);

  const fetchAvailability = useCallback((dealerId: string, eeNumber: string | null) => {
    if (availCacheRef.current.has(dealerId)) return;
    if (!eeNumber) { setAvailCache(prev => new Map(prev).set(dealerId, null)); return; }
    setAvailCache(prev => new Map(prev).set(dealerId, 'loading'));
    dealersApi.availability(eeNumber, weekStartStr).then(res => {
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
      const [dealerRes, schedRes, toRes, projRes, availRes] = await Promise.all([
        dealersApi.list({ type: activeTab, size: 10000 }),
        scheduleApi.list({ week_start: weekStartStr, dealer_type: activeTab }),
        timeOffApi.list({ week_start: weekStartStr, status: 'approved' }),
        projectionApi.get(weekStartStr).catch(() => ({ data: { days: [] } })),
        adminRequestsApi.availability(weekStartStr, 1, 10000).catch(() => ({ data: { data: [], total: 0 } })),
      ]);
      setDealers(dealerRes.data.data);
      const allEntries: ScheduleEntryDTO[] = [];
      (schedRes.data as any[]).forEach((s: any) => {
        if (s.entries) allEntries.push(...s.entries);
      });
      setEntries(allEntries);
      setTimeOffs(toRes.data as TimeOffDTO[]);
      setProjectionData(projRes.data.days || []);
      // Build availability map from batch result
      const aMap = new Map<string, AvailDTO>();
      ((availRes.data.data || availRes.data) as any[]).forEach((a: any) => {
        aMap.set(a.dealerId, { shift: a.shift, preferredDaysOff: a.preferredDaysOff || [] });
      });
      setAvailMap(aMap);
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
    let list = dealers.filter(d => scheduledIds.has(d.id));
    if (searchText) {
      const s = searchText.toLowerCase();
      list = list.filter(d =>
        d.firstName.toLowerCase().includes(s) ||
        d.lastName.toLowerCase().includes(s) ||
        (d.eeNumber || '').toLowerCase().includes(s)
      );
    }
    // Shift type filter: only show dealers who have at least one entry matching the selected shift
    if (shiftFilter) {
      const shiftValue = shiftFilter === 'day' ? '9AM' : '4PM';
      const matchingDealerIds = new Set(entries.filter(e => e.shift === shiftValue).map(e => e.dealerId));
      list = list.filter(d => matchingDealerIds.has(d.id));
    }
    // EE Number sort
    if (eeSortOrder) {
      list = [...list].sort((a, b) => {
        const eeA = a.eeNumber || '';
        const eeB = b.eeNumber || '';
        return eeSortOrder === 'asc' ? eeA.localeCompare(eeB) : eeB.localeCompare(eeA);
      });
    }
    return list;
  }, [dealers, entries, searchText, shiftFilter, eeSortOrder]);

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

  // Shortage calculation: compare projection demand vs actual assigned
  const shortages = useMemo(() => {
    if (projectionData.length === 0 || entries.length === 0) return [];
    const result: { date: string; shift: string; needed: number; assigned: number; short: number }[] = [];
    // Build demand map from projection: date+shift -> dealersNeeded
    const demandMap = new Map<string, number>();
    projectionData.forEach(day => {
      (day.slots || []).forEach(slot => {
        const timeStr = slot.time.toUpperCase().replace(/\s+/g, '');
        // Match backend logic: time contains 9/10/11/12 -> 9AM, otherwise -> 4PM
        const shift = /(?:^|\D)(9|10|11|12)(?:\D|$)/.test(timeStr) ? '9AM' : '4PM';
        const key = `${day.date}_${shift}`;
        demandMap.set(key, (demandMap.get(key) || 0) + slot.dealersNeeded);
      });
    });
    // Build assigned count map: date+shift -> count
    const assignedMap = new Map<string, number>();
    entries.forEach(e => {
      const key = `${e.date}_${e.shift}`;
      assignedMap.set(key, (assignedMap.get(key) || 0) + 1);
    });
    // Compare
    demandMap.forEach((needed, key) => {
      const assigned = assignedMap.get(key) || 0;
      if (assigned < needed) {
        const [dateStr, shift] = key.split('_');
        result.push({ date: dateStr, shift, needed, assigned, short: needed - assigned });
      }
    });
    result.sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
    return result;
  }, [projectionData, entries]);

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SHIFT_LABELS: Record<string, string> = { day: 'Day (AM)', swing: 'Swing (PM)', mixed: 'Mixed' };
  const SHIFT_MAP: Record<string, string> = { '9AM': 'day', '4PM': 'swing' };

  // Per-dealer satisfaction calculation
  const satisfactionMap = useMemo(() => {
    const map = new Map<string, {
      score: number;
      shiftScore: number;
      daysOffScore: number;
      shiftPref: string;
      matchedShifts: number;
      totalShifts: number;
      violatedDaysOff: { day: number; date: string }[];
      preferredDaysOff: number[];
    }>();
    if (entries.length === 0) return map;
    filteredDealers.forEach(d => {
      const avail = availMap.get(d.id);
      if (!avail) return;
      const dealerEntries = entries.filter(e => e.dealerId === d.id);
      if (dealerEntries.length === 0) return;

      // Shift match
      const matchedShifts = dealerEntries.filter(e => SHIFT_MAP[e.shift] === avail.shift).length;
      const shiftScore = matchedShifts / dealerEntries.length;

      // Days off match
      let daysOffScore = 1;
      const violatedDaysOff: { day: number; date: string }[] = [];
      if (avail.preferredDaysOff.length > 0) {
        const scheduledDays = new Map<number, string>();
        dealerEntries.forEach(e => scheduledDays.set(dayjs(e.date).day(), e.date));
        avail.preferredDaysOff.forEach(day => {
          if (scheduledDays.has(day)) {
            violatedDaysOff.push({ day, date: scheduledDays.get(day)! });
          }
        });
        const satisfied = avail.preferredDaysOff.length - violatedDaysOff.length;
        daysOffScore = satisfied / avail.preferredDaysOff.length;
      }

      const score = Math.round((shiftScore + daysOffScore) / 2 * 100);
      map.set(d.id, {
        score, shiftScore, daysOffScore,
        shiftPref: avail.shift,
        matchedShifts, totalShifts: dealerEntries.length,
        violatedDaysOff, preferredDaysOff: avail.preferredDaysOff,
      });
    });
    return map;
  }, [filteredDealers, entries, availMap]);

  const renderDealerPopover = (record: DealerDTO) => {
    const cached: AvailDTO | null | 'loading' | undefined = availMap.get(record.id) || availCache.get(record.id);
    const dealerEntries = entries.filter(e => e.dealerId === record.id);
    const totalDays = dealerEntries.length;
    const shifts = [...new Set(dealerEntries.map(e => e.shift))];

    // Time-off dates for this dealer
    const dealerTimeOffs = timeOffs.filter(t => t.dealerId === record.id);
    const timeOffDates: string[] = [];
    dealerTimeOffs.forEach(t => {
      let cur = dayjs(t.startDate);
      const end = dayjs(t.endDate);
      while (cur.isBefore(end, 'day') || cur.isSame(end, 'day')) {
        timeOffDates.push(cur.format('MM/DD (ddd)'));
        cur = cur.add(1, 'day');
      }
    });

    return (
      <div style={{ minWidth: 200, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          {record.firstName} {record.lastName}
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

        {timeOffDates.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Time Off</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {timeOffDates.map(d => (
                <Tag key={d} color="orange" style={{ margin: 0 }}>{d}</Tag>
              ))}
            </div>
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
      minWidth: 120,
      fixed: 'left' as const,
      render: (_: any, record: DealerDTO) => (
        <Popover
          content={() => renderDealerPopover(record)}
          trigger="hover"
          placement="right"
          onOpenChange={open => { if (open) fetchAvailability(record.id, record.eeNumber); }}
        >
          <span style={{ cursor: 'pointer', borderBottom: '1px dashed #bfbfbf' }}>{record.lastName}</span>
        </Popover>
      ),
    },
    {
      title: 'First Name',
      key: 'firstName',
      width: 110,
      minWidth: 110,
      fixed: 'left' as const,
      render: (_: any, record: DealerDTO) => record.firstName,
    },
    {
      title: 'EE Number',
      dataIndex: 'eeNumber',
      width: 100,
      minWidth: 100,
      fixed: 'left' as const,
    },
    {
      title: 'Satisfaction',
      key: 'satisfaction',
      width: 110,
      minWidth: 110,
      fixed: 'left' as const,
      align: 'center' as const,
      sorter: (a: DealerDTO, b: DealerDTO) => {
        const sa = satisfactionMap.get(a.id)?.score ?? -1;
        const sb = satisfactionMap.get(b.id)?.score ?? -1;
        return sa - sb;
      },
      render: (_: any, record: DealerDTO) => {
        const sat = satisfactionMap.get(record.id);
        if (!sat) return <span style={{ color: '#bfbfbf' }}>-</span>;
        const color = sat.score >= 80 ? '#52c41a' : sat.score >= 50 ? '#faad14' : '#ff4d4f';
        const mismatchedShifts = sat.totalShifts - sat.matchedShifts;
        const tooltipContent = (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Satisfaction Breakdown</div>
            <div style={{ marginBottom: 4 }}>
              Shift: {sat.matchedShifts}/{sat.totalShifts} match
              {mismatchedShifts > 0 && (
                <span style={{ color: '#ff4d4f' }}> ({mismatchedShifts} mismatch, pref: {SHIFT_LABELS[sat.shiftPref] || sat.shiftPref})</span>
              )}
            </div>
            {sat.preferredDaysOff.length > 0 && (
              <div>
                Days Off: {sat.preferredDaysOff.length - sat.violatedDaysOff.length}/{sat.preferredDaysOff.length} respected
                {sat.violatedDaysOff.length > 0 && (
                  <div style={{ color: '#ff4d4f', marginTop: 2 }}>
                    Violated: {sat.violatedDaysOff.map(v => `${DAY_NAMES[v.day]} ${dayjs(v.date).format('M/D')}`).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
        return (
          <Tooltip title={tooltipContent} placement="right">
            <span style={{ cursor: 'pointer', fontWeight: 600, color }}>{sat.score}%</span>
          </Tooltip>
        );
      },
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
        minWidth: 80,
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
        <Input.Search
          placeholder="Search by name or EE Number"
          allowClear
          style={{ width: 220 }}
          onSearch={v => setSearchText(v.trim())}
          onChange={e => { if (!e.target.value) setSearchText(''); }}
        />
        <Select
          placeholder="Filter by Shift"
          allowClear
          style={{ width: 160 }}
          value={shiftFilter}
          onChange={v => { setShiftFilter(v || null); setPage(1); }}
          options={[
            { label: 'Day Shift (9AM)', value: 'day' },
            { label: 'Swing Shift (4PM)', value: 'swing' },
          ]}
        />
        <Button
          icon={eeSortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
          onClick={() => {
            setEeSortOrder(prev => {
              if (prev === null) return 'asc';
              if (prev === 'asc') return 'desc';
              return null;
            });
          }}
          type={eeSortOrder ? 'primary' : 'default'}
          ghost={!!eeSortOrder}
        >
          EE# {eeSortOrder === 'asc' ? '↑' : eeSortOrder === 'desc' ? '↓' : ''}
        </Button>
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
        {entries.length > 0 && (
          <Popconfirm
            title="Clear Schedule"
            description={`Are you sure you want to clear all schedules for ${weekStartStr} ~ ${weekEndStr}?`}
            onConfirm={async () => {
              try {
                await scheduleApi.delete(weekStartStr, activeTab);
                message.success('Schedule cleared');
                fetchData();
              } catch {
                message.error('Failed to clear schedule');
              }
            }}
            okText="Confirm"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />}>Clear</Button>
          </Popconfirm>
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

      {/* Shortage alerts */}
      {shortages.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16, borderLeft: '3px solid #ff4d4f' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
            <span style={{ fontWeight: 600, color: '#ff4d4f' }}>
              Coverage Shortage ({shortages.reduce((s, x) => s + x.short, 0)} dealers short)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {shortages.map(s => (
              <Tag
                key={`${s.date}_${s.shift}`}
                color="red"
                style={{ margin: 0 }}
              >
                {dayjs(s.date).format('ddd M/D')} {s.shift} : {s.assigned}/{s.needed} (short {s.short})
              </Tag>
            ))}
          </div>
        </Card>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as DealerType)}
        items={tabItems}
      />

      {!loading && filteredDealers.length === 0 ? (
        <Empty description="No schedule data" style={{ padding: 60 }} />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredDealers}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 120 + 110 + 100 + 110 + weekDates.length * 80, y: 600 }}
          pagination={{
            current: page, pageSize, showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200'],
            showTotal: t => `${t} dealers`,
            onChange: (p, s) => { setPage(p); setPageSize(s); },
          }}
        />
      )}
    </div>
  );
};

export default Schedule;
