import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Popover, List, Button, Typography } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { notificationApi, NotificationItem } from '../api/schedule';

const { Text } = Typography;

const TYPE_COLOR: Record<string, string> = {
  success: '#52c41a', warning: '#faad14', error: '#ff4d4f', info: '#1677ff',
};

const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([notificationApi.list(), notificationApi.unreadCount()]);
      setItems(listRes.data);
      setUnread(countRes.data.count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetch(); const t = setInterval(fetch, 10000); return () => clearInterval(t); }, [fetch]);

  const markRead = async (id: number) => {
    await notificationApi.markRead(id);
    fetch();
  };

  const markAllRead = async () => {
    await notificationApi.markAllRead();
    fetch();
  };

  const content = (
    <div style={{ width: 340 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 8px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong>Notifications</Text>
        {unread > 0 && <Button type="link" size="small" icon={<CheckOutlined />} onClick={markAllRead}>Mark all read</Button>}
      </div>
      <List
        dataSource={items.slice(0, 20)}
        locale={{ emptyText: 'No notifications' }}
        renderItem={item => (
          <List.Item
            style={{ padding: '8px 0', cursor: 'pointer', opacity: item.isRead ? 0.6 : 1 }}
            onClick={() => !item.isRead && markRead(item.id)}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[item.type] || '#999', display: 'inline-block' }} />
                <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{item.message}</div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{item.createdAt?.replace('T', ' ').slice(0, 19)}</div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight">
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
