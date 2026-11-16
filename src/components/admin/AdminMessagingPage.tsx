import type { adminMessagingData } from "@/app/lib/admin-messaging";
import AdminMessaging from "./AdminMessaging";

export default function AdminMessagingPage({ model, openThread = false }: { model: Awaited<ReturnType<typeof adminMessagingData>>; openThread?: boolean }) {
  const serialize = (row: NonNullable<typeof model.selected>) => ({ ...row, updatedAt: row.updatedAt.toISOString() });
  return <div className="admin-content am-workspace"><header className="am-page-heading"><div><h1>Messagerie</h1><p>Consultez les échanges entre clients et professionnels en lecture seule.</p></div><span className="am-readonly">Lecture seule</span></header>
    <AdminMessaging key={`${model.selected?.id ?? "empty"}:${model.filters.q}:${model.data.page}`} rows={model.data.rows.map(serialize)} selected={model.selected ? serialize(model.selected) : null} q={model.filters.q} total={model.data.total} page={model.data.page} openThread={openThread}/>
  </div>;
}
