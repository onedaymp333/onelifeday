import Link from "next/link";

interface TabEntity {
  id: string;
  name: string;
}

export default function EntityTabs({
  entities,
  currentId,
  basePath,
}: {
  entities: TabEntity[];
  currentId: string | null;
  basePath: string;
}) {
  const tabs: { id: string | null; name: string }[] = [
    { id: null, name: "All books" },
    ...entities.map((e) => ({ id: e.id, name: e.name })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const active = (t.id ?? null) === (currentId ?? null);
        const href = t.id ? `${basePath}?entity=${t.id}` : basePath;
        return (
          <Link
            key={t.id ?? "all"}
            href={href}
            className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${
              active
                ? "bg-brand text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </div>
  );
}
