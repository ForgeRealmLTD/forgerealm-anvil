import type { MmBackRoomRow } from '../../types-anvil';

interface BackRoomProps {
  rows: MmBackRoomRow[];
  stock: { on_display: number; in_back: number; total: number; unshelved_lines: number };
  onPutOut: (row: MmBackRoomRow) => void;
  onAssignBay: (row: MmBackRoomRow) => void;
  onAdd: () => void;
  onEditQty: (row: MmBackRoomRow) => void;
}

// Storage at the back of the store: stock that isn't on the shelf but that
// staff can put out. Ordered the way the job is actually done — the bays
// running low come first, then anything with no bay at all, then by how much
// is sitting in the box.
export default function BackRoom({ rows, stock, onPutOut, onAssignBay, onAdd, onEditQty }: BackRoomProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Back of shop</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              In storage, not on the shelf. Staff can put any of it out.
            </p>
          </div>
          <button
            onClick={onAdd}
            className="shrink-0 h-9 px-3.5 rounded-xl bg-gradient-gold text-navy text-xs font-semibold shadow-glow-gold-sm active:scale-95 transition-transform"
          >
            + Stock
          </button>
        </div>
        <div className="flex items-baseline gap-5 text-right">
          <span className="text-xs text-gray-500">
            On display <span className="ml-1 text-sm text-gray-200 tabular-nums">{stock.on_display}</span>
          </span>
          <span className="text-xs text-gray-500">
            In the back <span className="ml-1 text-sm text-gray-200 tabular-nums">{stock.in_back}</span>
          </span>
          <span className="text-xs text-gray-500">
            Total stock{' '}
            <span className="ml-1 font-display text-xl font-semibold text-gold tabular-nums">
              {stock.total}
            </span>
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 mt-5">
          Nothing in storage yet. <span className="text-gray-400">+ Stock</span> puts units in the
          back, whether or not the product has a bay, and anything taken off the shelf lands here
          too.
        </p>
      ) : (
        <>
          {stock.unshelved_lines > 0 && (
            <p className="text-xs text-gray-400 mt-4 rounded-lg bg-white/[0.04] px-3 py-2">
              {stock.unshelved_lines === 1 ? '1 line has' : `${stock.unshelved_lines} lines have`}{' '}
              stock in the back but no bay on the shelf. Give them a bay to put them out.
            </p>
          )}

          {/* Mobile: rows */}
          <div className="md:hidden divide-y divide-white/[0.04] mt-3 -mx-4">
            {rows.map((r) => (
              <div key={r.product_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className="block text-sm text-white truncate">{r.name}</span>
                  <span className="block text-[10px] font-mono text-gray-600">
                    {r.bay_code ?? 'No bay'}
                    {r.colour ? ` · ${r.colour}` : ''}
                  </span>
                </div>
                <button onClick={() => onEditQty(r)} className="text-right shrink-0 active:scale-95 transition-transform">
                  <span className="block text-sm text-white tabular-nums underline decoration-dotted decoration-white/25 underline-offset-4">
                    {r.back_qty}
                  </span>
                  <span className="block text-[10px] text-gray-500">in back</span>
                </button>
                <div className="text-right shrink-0 w-12">
                  <span className="block text-sm text-gray-400 tabular-nums">{r.total_qty}</span>
                  <span className="block text-[10px] text-gray-500">total</span>
                </div>
                {r.shelved ? (
                  <button
                    onClick={() => onPutOut(r)}
                    className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-semibold active:scale-95 transition-transform
                      ${r.needs_restock
                        ? 'bg-gradient-gold text-navy shadow-glow-gold-sm'
                        : 'border border-white/[0.08] text-gray-300'}`}
                  >
                    Put out
                  </button>
                ) : (
                  <button
                    onClick={() => onAssignBay(r)}
                    className="shrink-0 px-3 py-2 rounded-xl border border-gold/40 text-gold text-[11px] font-semibold active:scale-95 transition-transform"
                  >
                    Give a bay
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-500">
                  {['Product', 'Colour', 'Bay', 'In back', 'On display', 'Total', ''].map((h) => (
                    <th key={h} className="text-left font-medium py-2 pr-6 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((r) => (
                  <tr key={r.product_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-6 text-gray-200">{r.name}</td>
                    <td className="py-2.5 pr-6 text-xs text-gray-400">{r.colour ?? '—'}</td>
                    <td className="py-2.5 pr-6 font-mono text-xs">
                      {r.bay_code ? (
                        <span className="text-gray-500">{r.bay_code}</span>
                      ) : (
                        <span className="text-gold/70">No bay</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-6 tabular-nums">
                      <button
                        onClick={() => onEditQty(r)}
                        className="text-white underline decoration-dotted decoration-white/25 underline-offset-4 hover:text-gold transition-colors"
                        title="Add to or recount this line"
                      >
                        {r.back_qty}
                      </button>
                    </td>
                    <td className="py-2.5 pr-6 tabular-nums text-gray-300">{r.display_qty}</td>
                    <td className="py-2.5 pr-6 tabular-nums text-gray-300">{r.total_qty}</td>
                    <td className="py-2.5">
                      {r.shelved ? (
                        <button
                          onClick={() => onPutOut(r)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors
                            ${r.needs_restock
                              ? 'bg-gradient-gold text-navy'
                              : 'border border-white/[0.08] text-gray-300 hover:text-white'}`}
                        >
                          Put out
                        </button>
                      ) : (
                        <button
                          onClick={() => onAssignBay(r)}
                          className="px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-[11px] font-semibold hover:bg-gold/10 transition-colors"
                        >
                          Give a bay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
