import { List, useTable, DeleteButton } from '@refinedev/antd';
import { Table, Space } from 'antd';

/**
 * Session viewer untuk admin: daftar sesi aktif (device, IP, waktu) + revoke.
 * Revoke memanggil DELETE /sessions/:id dan tercatat di audit log.
 */
export const SessionList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List title="Active Sessions">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="userId" title="User ID" />
        <Table.Column dataIndex="userAgent" title="Device / Agent" render={(v: string) => v ?? '-'} />
        <Table.Column dataIndex="ipAddress" title="IP" render={(v: string) => v ?? '-'} />
        <Table.Column
          dataIndex="lastSeenAt"
          title="Last Seen"
          render={(v: string) => (v ? new Date(v).toLocaleString() : '-')}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <DeleteButton
                hideText
                size="small"
                recordItemId={record.id}
                confirmTitle="Revoke sesi ini?"
                confirmOkText="Revoke"
              />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
