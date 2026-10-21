import { useCallback, useState } from 'react'
import { NowContext, useOfficeState } from './useOfficeState'
import { Office } from './components/Office'
import { BottomBar } from './components/BottomBar'
import { TaskPanel } from './components/TaskPanel'
import { TaskDetail } from './components/TaskDetail'

export default function App() {
  const { state, demo, now, actors } = useOfficeState()
  const [panel, setPanel] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const close = useCallback(() => setSel(null), [])
  const selected = sel ? state?.tasks.find((t) => t.id === sel) ?? actors.find((a) => a.id === sel)?.task : undefined

  return (
    <NowContext.Provider value={now}>
      <div className="flex h-full w-full flex-col" onClick={close}>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <Office actors={actors} now={now} managerActive={!!state?.manager?.active} onSelect={setSel} />
          <div className="pointer-events-none absolute left-3 top-3 z-[1500] flex items-center gap-2">
            <div className="pixel-box px-2 py-[3px] text-[12px] font-bold">🏢 Agent Office</div>
            {demo && <div className="border-2 border-ink bg-[#e8c15a] px-[6px] py-[2px] text-[10px] font-bold shadow-[2px_2px_0_#2b1a12]">demo data</div>}
            {!state && <div className="border-2 border-ink bg-cream px-[6px] py-[2px] text-[10px]">loading…</div>}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <TaskPanel open={panel} onToggle={() => setPanel((v) => !v)} tasks={state?.tasks ?? []} now={now} onPick={setSel} />
          </div>
          {selected && (
            <div onClick={(e) => e.stopPropagation()}>
              <TaskDetail task={selected} now={now} onClose={close} />
            </div>
          )}
        </div>
        <BottomBar state={state} budget={state?.budget} />
      </div>
    </NowContext.Provider>
  )
}
