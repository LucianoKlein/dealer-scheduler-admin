import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Select, Button, InputNumber, message, Switch, Card, Tag, Table, Empty, Modal, Alert, Progress, Popconfirm, Spin,
} from 'antd';
import {
  SaveOutlined, SettingOutlined, EditOutlined, PlusOutlined, DeleteOutlined, ClearOutlined,
  TeamOutlined, TrophyOutlined, ThunderboltOutlined,
  DownloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWeek } from '../contexts/WeekContext';
import WeekPicker from '../components/WeekPicker';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { WeeklyProjection, DailyProjection, TimeSlot, GameEvent } from '../types';
import { projectionApi } from '../api/projection';
import { scheduleApi } from '../api/schedule';
import { timeOffApi } from '../api/timeOff';
import gameData from '../assets/game.json';

const statusAlert = (s: string) => {
  if (s === 'OPTIMAL' || s === 'CLOUD_OPTIMAL') return { label: 'Optimal', color: '#52c41a', type: 'success', desc: 'Optimal solution found. All constraints satisfied.' };
  if (s === 'FEASIBLE' || s === 'CLOUD_FEASIBLE') return { label: 'Feasible', color: '#faad14', type: 'warning', desc: 'Feasible solution found, but may not be optimal. Please review the schedule.' };
  if (s === 'INFEASIBLE' || s === 'CLOUD_INFEASIBLE') return { label: 'Failed', color: '#ff4d4f', type: 'error', desc: 'Unable to satisfy all constraints. Please adjust demand or staffing.' };
  return { label: 'Unknown', color: '#999', type: 'info', desc: 'Solver returned an unknown status. Please contact the administrator.' };
};

dayjs.extend(customParseFormat);

const YEAR = 2026;

// Parse game.json dates into YYYY-MM-DD keyed map
const gameEventsByDate: Record<string, GameEvent[]> = {};
(gameData as GameEvent[]).forEach(evt => {
  const parsed = dayjs(`${evt.date} ${YEAR}`, 'MMM DD hh:mm A YYYY');
  if (!parsed.isValid()) return;
  const key = parsed.format('YYYY-MM-DD');
  if (!gameEventsByDate[key]) gameEventsByDate[key] = [];
  gameEventsByDate[key].push(evt);
});

const Projection: React.FC = () => {
  const { weekStart, weekStartStr } = useWeek();
  const navigate = useNavigate();
  const [projection, setProjection] = useState<WeeklyProjection>({ weekStart: '', days: [] });
  const [loading, setLoading] = useState(false);
  const [hideUnedited, setHideUnedited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastResult, setLastResult] = useState<{ totalAssignments: number; unfilledSlots: number; solverStatus: string; solveTimeMs: number; stats?: { fullySatisfied: number; partiallySatisfied: number; unsatisfied: number; totalWithPreference: number; unfilledBreakdown: any[] } | null } | null>(null);

  useEffect(() => {
    const loadProjection = async () => {
      setLoading(true);
      try {
        const res = await projectionApi.get(weekStartStr);
        setProjection(res.data);
      } catch {
        // No projection yet, init empty
        const days: DailyProjection[] = [];
        for (let i = 0; i < 7; i++) {
          days.push({ date: weekStart.add(i, 'day').format('YYYY-MM-DD'), slots: [] });
        }
        setProjection({ weekStart: weekStartStr, days });
      } finally {
        setLoading(false);
      }
    };
    loadProjection();
    setGenerated(false);
    setLastResult(null);
  }, [weekStartStr]);

  const addSlot = (dayIndex: number) => {
    setProjection(prev => {
      const days = [...prev.days];
      const slots = [...days[dayIndex].slots, { time: '12 PM', dealersNeeded: 0 }];
      days[dayIndex] = { ...days[dayIndex], slots };
      return { ...prev, days };
    });
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setProjection(prev => {
      const days = [...prev.days];
      const slots = days[dayIndex].slots.filter((_, i) => i !== slotIndex);
      days[dayIndex] = { ...days[dayIndex], slots };
      return { ...prev, days };
    });
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: keyof TimeSlot, value: any) => {
    if (value === null) return;
    setProjection(prev => {
      const days = [...prev.days];
      const slots = [...days[dayIndex].slots];
      slots[slotIndex] = { ...slots[slotIndex], [field]: value };
      days[dayIndex] = { ...days[dayIndex], slots };
      return { ...prev, days };
    });
  };

  const handleSave = async () => {
    try {
      await projectionApi.save(weekStartStr, { days: projection.days });
      setEditing(false);
      message.success('Projection saved');
    } catch {
      message.error('Failed to save projection');
    }
  };

  const handleClear = async () => {
    try {
      await projectionApi.delete(weekStartStr);
      const days: DailyProjection[] = [];
      for (let i = 0; i < 7; i++) {
        days.push({ date: weekStart.add(i, 'day').format('YYYY-MM-DD'), slots: [] });
      }
      setProjection({ weekStart: weekStartStr, days });
      setEditing(false);
      message.success('Projection cleared');
    } catch {
      message.error('Failed to clear projection');
    }
  };

  // Totals
  const totalDealers = projection.days.reduce((s, d) => s + d.slots.reduce((ss, sl) => ss + sl.dealersNeeded, 0), 0);
  const avgDealersPerDay = (totalDealers / 7).toFixed(1);

  // Pending time-off count
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  useEffect(() => {
    timeOffApi.list({ week_start: weekStartStr, status: 'pending' }).then(res => {
      setPendingTimeOffCount((res.data as any[]).length);
    }).catch(() => {});
  }, [weekStartStr]);

  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [realProgress, setRealProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const generateSchedule = async () => {
    setGenerating(true);
    setRealProgress(0);
    setProgressPhase('Submitting task...');
    try {
      const res = await scheduleApi.generate({ weekStart: weekStartStr, dealerType: 'tournament' });
      const taskId = res.data.taskId;
      // Start polling
      pollTimer.current = setInterval(async () => {
        try {
          const poll = await scheduleApi.taskStatus(taskId);
          const t = poll.data;
          setRealProgress(t.progress);
          setProgressPhase(t.phase);
          if (t.status === 'completed' && t.result) {
            stopPolling();
            setRealProgress(100);
            setLastResult(t.result);
            setConfirmOpen(false);
            setGenerated(true);
            setGenerating(false);
            setResultModalOpen(true);
          } else if (t.status === 'failed') {
            stopPolling();
            setRealProgress(0);
            setGenerating(false);
            message.error(t.error || 'Schedule generation failed');
          }
        } catch {
          stopPolling();
          setGenerating(false);
          message.error('Failed to poll task status');
        }
      }, 2000);
    } catch {
      setRealProgress(0);
      setGenerating(false);
      message.error('Failed to start schedule generation');
    }
  };

  const exportExcel = async () => {
    setDownloading(true);
    try {
      const res = await scheduleApi.downloadExcel(weekStartStr, 'tournament');
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_tournament_${weekStartStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Failed to download Excel');
    } finally {
      setDownloading(false);
    }
  };

  // Filter days: hideUnedited only hides the events section, all days remain visible
  const visibleDays = projection.days;

  // Event table columns for expanded rows
  const eventColumns = [
    {
      title: 'Event #',
      dataIndex: 'eventNum',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Time',
      dataIndex: 'date',
      width: 140,
      render: (v: string) => {
        const m = v.match(/\d{1,2}:\d{2}\s*[AP]M/i);
        return m ? m[0] : v;
      },
    },
    {
      title: 'Title',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: 'Buy-in',
      dataIndex: 'buyIn',
      width: 100,
      render: (v: string) => <span style={{ color: '#389e0d', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Clock',
      dataIndex: 'clock',
      width: 80,
    },
    {
      title: 'Late Reg',
      dataIndex: 'lateReg',
      width: 100,
    },
    {
      title: 'Format',
      dataIndex: 'format',
      width: 200,
      ellipsis: true,
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <WeekPicker />

        <div style={{ flex: 1 }} />

        <SettingOutlined style={{ fontSize: 14, color: '#999' }} />
        <Switch
          checked={hideUnedited}
          onChange={setHideUnedited}
          checkedChildren="Hide unedited"
          unCheckedChildren="Hide unedited"
          style={{ minWidth: 140 }}
        />

        {editing ? (
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Save Projection
          </Button>
        ) : (
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {totalDealers > 0 && (
          <Popconfirm
            title="Clear Projection"
            description="Are you sure you want to clear all projection data for this week?"
            onConfirm={handleClear}
            okText="Confirm"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<ClearOutlined />}>Clear</Button>
          </Popconfirm>
        )}
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => setConfirmOpen(true)}
        >
          Generate Schedule
        </Button>
        {generated && (
          <Button icon={<DownloadOutlined />} loading={downloading} onClick={exportExcel}>
            {downloading ? 'Generating...' : 'Download Excel'}
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #52c41a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Avg Dealers / Day</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>{avgDealersPerDay}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, borderLeft: '3px solid #faad14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>Events (Total)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>
                {projection.days.reduce((s, d) => s + (gameEventsByDate[d.date]?.length || 0), 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Day cards */}
      <Spin spinning={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleDays.length === 0 && (
          <Card><Empty description="No events" /></Card>
        )}
        {visibleDays.map((day) => {
          const realIndex = projection.days.findIndex(d => d.date === day.date);
          const events = gameEventsByDate[day.date] || [];
          const dateObj = dayjs(day.date);
          const isWeekend = dateObj.day() === 0 || dateObj.day() === 6;

          return (
            <Card
              key={day.date}
              size="small"
              style={{
                borderRadius: 8,
                border: isWeekend ? '1px solid #d9d9d9' : '1px solid #e8e8e8',
                background: isWeekend ? '#fafafa' : '#fff',
              }}
            >
              {/* Day header row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: (day.slots.length > 0 || events.length > 0) ? 12 : 0,
              }}>
                {/* Date badge */}
                <div style={{ minWidth: 100, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: isWeekend ? '#fff7e6' : '#e6f4ff',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>
                    <span style={{ fontSize: 10, color: '#999', fontWeight: 500 }}>
                      {dateObj.format('ddd').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: isWeekend ? '#fa8c16' : '#1677ff' }}>
                      {dateObj.format('DD')}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: '#666' }}>{dateObj.format('MM/DD')}</span>
                </div>

                {/* Day totals */}
                <Tag color="green">
                  Dealers Needed: {day.slots.reduce((s, sl) => s + sl.dealersNeeded, 0)}
                </Tag>

                <div style={{ flex: 1 }} />
                {events.length > 0 && (
                  <Tag icon={<TrophyOutlined />} color="gold">
                    {events.length} {events.length === 1 ? 'event' : 'events'}
                  </Tag>
                )}
                {editing && (
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => addSlot(realIndex)}
                  >
                    Add Time Slot
                  </Button>
                )}
              </div>

              {/* Time slots table */}
              {day.slots.length > 0 && (
                <div style={{ marginBottom: events.length > 0 ? 12 : 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                        <th style={{ padding: '6px 12px', width: 140, borderBottom: '1px solid #f0f0f0' }}>Time</th>
                        <th style={{ padding: '6px 12px', width: 160, borderBottom: '1px solid #f0f0f0' }}>Dealers Needed</th>
                        {editing && <th style={{ padding: '6px 12px', width: 60, borderBottom: '1px solid #f0f0f0' }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {day.slots.map((slot, si) => (
                        <tr key={si} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '6px 12px' }}>
                            {editing ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <Select
                                  value={slot.time.match(/^(\d{1,2})/)?.[1] || '12'}
                                  size="small"
                                  style={{ width: 65 }}
                                  onChange={v => {
                                    const ampm = slot.time.match(/(AM|PM)$/i)?.[1] || 'PM';
                                    updateSlot(realIndex, si, 'time', `${v} ${ampm}`);
                                  }}
                                  options={Array.from({ length: 12 }, (_, i) => {
                                    const h = i === 0 ? 12 : i;
                                    return { label: `${h}`, value: `${h}` };
                                  })}
                                />
                                <Select
                                  value={slot.time.match(/(AM|PM)$/i)?.[1]?.toUpperCase() || 'PM'}
                                  size="small"
                                  style={{ width: 65 }}
                                  onChange={v => {
                                    const hour = slot.time.match(/^(\d{1,2})/)?.[1] || '12';
                                    updateSlot(realIndex, si, 'time', `${hour} ${v}`);
                                  }}
                                  options={[
                                    { label: 'AM', value: 'AM' },
                                    { label: 'PM', value: 'PM' },
                                  ]}
                                />
                              </div>
                            ) : (
                              <span style={{ fontWeight: 500 }}>{slot.time}</span>
                            )}
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            {editing ? (
                              <InputNumber min={0} value={slot.dealersNeeded} size="small" style={{ width: 80 }}
                                onChange={v => updateSlot(realIndex, si, 'dealersNeeded', v)} />
                            ) : (
                              <span style={{ color: '#52c41a', fontWeight: 600 }}>{slot.dealersNeeded}</span>
                            )}
                          </td>
                          {editing && (
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <Button type="link" danger size="small" icon={<DeleteOutlined />}
                                onClick={() => removeSlot(realIndex, si)} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Events table */}
              {events.length > 0 && !hideUnedited && (
                <Table
                  columns={eventColumns}
                  dataSource={events}
                  rowKey={(_, i) => String(i)}
                  size="small"
                  pagination={false}
                  style={{
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                />
              )}
            </Card>
          );
        })}
      </div>
      </Spin>
      {/* Generate Schedule Confirmation Modal */}
      <Modal
        title="Generate Schedule Confirmation"
        open={confirmOpen}
        onCancel={() => { if (!generating) setConfirmOpen(false); }}
        onOk={generateSchedule}
        okText={generating ? 'Generating...' : 'Confirm & Generate'}
        okButtonProps={{ loading: generating }}
        cancelButtonProps={{ disabled: generating }}
        closable
        maskClosable={false}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Projection Summary</h4>
          <Table
            size="small"
            pagination={false}
            dataSource={projection.days.filter(d => d.slots.length > 0)}
            rowKey="date"
            columns={[
              { title: 'Date', dataIndex: 'date', width: 120, render: (v: string) => dayjs(v).format('ddd MM/DD') },
              { title: 'Slots', width: 80, render: (_: any, d: DailyProjection) => d.slots.length },
              { title: 'Dealers Needed', render: (_: any, d: DailyProjection) => d.slots.reduce((s, sl) => s + sl.dealersNeeded, 0) },
            ]}
          />
          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
            Total: {totalDealers} dealer-shifts needed (avg {avgDealersPerDay} dealers/day)
          </div>
        </div>

        {generating && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={realProgress} status="active" strokeColor={{ from: '#108ee9', to: '#87d068' }} />
            {progressPhase && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{progressPhase}</div>}
          </div>
        )}

        {pendingTimeOffCount > 0 && !generating && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message={`${pendingTimeOffCount} pending time-off requests this week`}
            description={
              <span>
                Please review and approve/reject them before generating.{' '}
                <a onClick={() => { setConfirmOpen(false); navigate('/requests'); }}>
                  Go to Requests
                </a>
              </span>
            }
          />
        )}
      </Modal>

      {/* Generate Result Modal */}
      <Modal
        title="Schedule Generated"
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} loading={downloading} onClick={exportExcel}>
            {downloading ? 'Generating...' : 'Download Excel'}
          </Button>,
          <Button key="view" type="primary" onClick={() => { setResultModalOpen(false); navigate('/schedule'); }}>
            View Schedule
          </Button>,
        ]}
        width={560}
      >
        {lastResult && (
          <div style={{ padding: '8px 0' }}>
            <Alert
              type={statusAlert(lastResult.solverStatus).type as any}
              showIcon
              message={statusAlert(lastResult.solverStatus).label}
              description={statusAlert(lastResult.solverStatus).desc}
              style={{ marginBottom: 16 }}
            />
            {lastResult.unfilledSlots > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={`${lastResult.unfilledSlots} unfilled shifts`}
                description="Some shifts are not fully staffed. Please review the schedule and adjust manually."
                style={{ marginBottom: 16 }}
              />
            )}
            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#999' }}>Total Shifts</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>{lastResult.totalAssignments}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999' }}>Schedule Status</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: statusAlert(lastResult.solverStatus).color }}>
                  {statusAlert(lastResult.solverStatus).label}
                </div>
              </div>
            </div>
            {lastResult.stats && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Satisfaction Stats</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, background: '#f6ffed', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>{lastResult.stats.fullySatisfied}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>Fully Satisfied</div>
                  </div>
                  <div style={{ flex: 1, background: '#fffbe6', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#faad14' }}>{lastResult.stats.partiallySatisfied}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>Partially Satisfied</div>
                  </div>
                  <div style={{ flex: 1, background: '#fff2f0', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ff4d4f' }}>{lastResult.stats.unsatisfied}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>Unsatisfied</div>
                  </div>
                </div>
              </div>
            )}
            {lastResult.stats?.unfilledBreakdown && lastResult.stats.unfilledBreakdown.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Unfilled Details</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {lastResult.stats.unfilledBreakdown.map((u: any) => (
                    <span key={`${u.date}_${u.shift}`} style={{ background: '#fff2f0', color: '#ff4d4f', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                      {u.date} {u.shift}: {u.assigned}/{u.needed} (gap {u.gap})
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 13, color: '#666' }}>
              Solve time: {lastResult.solveTimeMs}ms
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Projection;
