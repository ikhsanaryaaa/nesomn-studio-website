import { List, useTable } from '@refinedev/antd';
import { Alert, Button, Table, Tag } from 'antd';

/** Read-only operational records. Financial mutations remain in audited API workflows. */
export function SubscriptionList() {
  const { tableProps, tableQuery } = useTable({
    resource: 'subscriptions',
    syncWithLocation: true,
  });
  return (
    <List title="Subscriptions" canCreate={false}>
      <p>
        Periode dan status dari server. Pembatalan tidak selalu langsung mengakhiri hak akses
        periode berjalan.
      </p>
      {tableQuery.isError && (
        <Alert
          type="error"
          message="Langganan gagal dimuat"
          action={<Button onClick={() => void tableQuery.refetch()}>Coba lagi</Button>}
        />
      )}
      <Table {...tableProps} rowKey="id" scroll={{ x: 1000 }}>
        <Table.Column dataIndex="userId" title="User ID" />
        <Table.Column dataIndex="planId" title="Plan ID" />
        <Table.Column dataIndex="status" title="Status" render={(v) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="gateway" title="Provider" />
        <Table.Column dataIndex="currentPeriodStart" title="Mulai" />
        <Table.Column dataIndex="currentPeriodEnd" title="Berakhir" />
      </Table>
    </List>
  );
}

export function CreditLedgerList() {
  const { tableProps, tableQuery } = useTable({
    resource: 'credit-ledger',
    syncWithLocation: true,
  });
  return (
    <List title="Credit ledger" canCreate={false}>
      <p>
        Riwayat transaksi credits dari server. Halaman ini tidak mengubah saldo atau status
        pembayaran.
      </p>
      {tableQuery.isError && (
        <Alert
          type="error"
          message="Ledger gagal dimuat"
          action={<Button onClick={() => void tableQuery.refetch()}>Coba lagi</Button>}
        />
      )}
      <Table {...tableProps} rowKey="id" scroll={{ x: 1100 }}>
        <Table.Column dataIndex="userId" title="User ID" />
        <Table.Column dataIndex="delta" title="Perubahan" />
        <Table.Column dataIndex="balanceAfter" title="Saldo sesudah" />
        <Table.Column dataIndex="reason" title="Alasan" />
        <Table.Column dataIndex="refId" title="Referensi" />
        <Table.Column dataIndex="createdAt" title="Waktu" />
      </Table>
    </List>
  );
}
