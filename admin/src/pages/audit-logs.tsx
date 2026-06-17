import { List, useTable } from '@refinedev/antd';
import { Table, Tag } from 'antd';

/**
 * Audit log viewer read-only. Tidak ada aksi create/update/delete dari UI:
 * data hanya ditulis server-side oleh writeAudit pada aksi sensitif.
 */
export const AuditLogList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });
  return (
    <List title="Audit Logs" canCreate={false}>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="createdAt"
          title="Time"
          render={(v: string) => (v ? new Date(v).toLocaleString() : '-')}
        />
        <Table.Column dataIndex="actorId" title="Actor" render={(v: string) => v ?? 'system'} />
        <Table.Column dataIndex="action" title="Action" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="targetType" title="Target Type" />
        <Table.Column dataIndex="targetId" title="Target ID" render={(v: string) => v ?? '-'} />
        <Table.Column
          dataIndex="meta"
          title="Meta"
          render={(v: unknown) => (
            <code style={{ fontSize: 11 }}>{v ? JSON.stringify(v) : '-'}</code>
          )}
        />
      </Table>
    </List>
  );
};
