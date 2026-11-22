"""R319 tab2: eliminate no-op accounting boot writes without changing ledger semantics.

Runs AFTER the proven R318 source builder. Fail closed if any anchor differs.
Never migrates or deletes storage, changes signatures, or touches tab1.
"""
from pathlib import Path
import re

root=Path("r305-android/tab2/POS7_Tablet")
assets=root/"app/src/main/assets/index.html"
gradle=root/"app/build.gradle"
html=assets.read_text(encoding="utf-8")

def once(source, old, new, marker):
    actual=source.count(old)
    if actual!=1:
        raise RuntimeError(f"R319 safety stop: {marker}: expected 1, got {actual}")
    return source.replace(old,new,1)

def patch_script(html, start, transforms):
    if html.count(start)!=1:
        raise RuntimeError("R319 safety stop: script anchor absent or ambiguous: "+start[:75])
    a=html.index(start)
    b=html.index("</script>",a)
    segment=html[a:b]
    for marker,old,new in transforms:
        segment=once(segment,old,new,marker)
    return html[:a]+segment+html[b:]

# v105 already checks if each cancelled voucher was repaired and if active
# vouchers were posted. Persist only if a repair was actually performed.
html=patch_script(html,"<script>\n/* POS7 v105 —",[
    ("v105 repair dirty flag",
     "  state.voucherReversals=state.voucherReversals||[];",
     "  let pos319RepairDirty=!state.voucherReversals;\n  state.voucherReversals=state.voucherReversals||[];"),
    ("v105 cancelled voucher repair",
     "    if(exists)return;\n    let account=v.account||pos105AccountFromLegacySource",
     "    if(exists)return;\n    pos319RepairDirty=true;\n    let account=v.account||pos105AccountFromLegacySource"),
    ("v105 supplier ledger migration",
     "v.paidAmount=amount;v.mcPosted=true;}",
     "v.paidAmount=amount;v.mcPosted=true;pos319RepairDirty=true;}"),
    ("v105 no-op boot save",
     "  persist();\n})();",
     "  if(pos319RepairDirty)persist();\n})();")
])

# v165: set indexes preserve strict foreign key matching and actual mcLedger
# ref semantics. At every sync rebuild from current state (supports rollback
# and state replacement), then track newly inserted journal rows. Existing
# persist() wrapper and mcPost() wrapper remain unchanged.
html=patch_script(html,'<script id="pos7-v165-unified-accounting-journal">',[
    ("v165 startup bookkeeping",
     "  state.accountingJournal=Array.isArray(state.accountingJournal)?state.accountingJournal:[];\n  state.accountingJournalSeq=Math.max(0,parseInt(state.accountingJournalSeq||0,10)||0);",
     "  const pos319JournalMissing=!Array.isArray(state.accountingJournal);\n  const pos319SeqRaw=state.accountingJournalSeq;\n  let pos319NewRows=0;\n  let pos319ForeignKeys=new Set(),pos319LedgerRefs=new Set();\n  state.accountingJournal=Array.isArray(state.accountingJournal)?state.accountingJournal:[];\n  state.accountingJournalSeq=Math.max(0,parseInt(state.accountingJournalSeq||0,10)||0);"),
    ("v165 foreign key Set",
     "  function exists(fk){return state.accountingJournal.some(x=>x&&x.foreignKey===fk)}",
     "  function exists(fk){return pos319ForeignKeys.has(fk)}"),
    ("v165 count new ledger journal entries",
     "      linkKey:row.linkKey||row.ref||row.voucherNo||row.foreignKey\n    });\n  }\n  function hasLedgerRef(ref){return !!ref&&(state.mcLedger||[]).some(x=>String(x.ref||'')===String(ref))}",
     "      linkKey:row.linkKey||row.ref||row.voucherNo||row.foreignKey\n    });\n    pos319ForeignKeys.add(row.foreignKey);\n    pos319NewRows++;\n  }\n  function hasLedgerRef(ref){return !!ref&&pos319LedgerRefs.has(String(ref))}"),
    ("v165 refresh index once per sync",
     "  function sync(){\n    state.accountingJournal=Array.isArray(state.accountingJournal)?state.accountingJournal:[];",
     "  function sync(){\n    state.accountingJournal=Array.isArray(state.accountingJournal)?state.accountingJournal:[];\n    pos319ForeignKeys=new Set(state.accountingJournal.filter(x=>x&&x.foreignKey!=null).map(x=>x.foreignKey));\n    pos319LedgerRefs=new Set((state.mcLedger||[]).map(x=>String(x.ref||'')));"),
    ("v165 no-op startup write",
     "  sync();\n  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}",
     "  sync();\n  if(pos319JournalMissing||state.accountingJournalSeq!==pos319SeqRaw||pos319NewRows>0){\n    try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}\n  }")
])

# Create only a new version; do not alter install identity or any cloud keys.
html=once(html,'المتجر الثاني — قاعدة مستقلة • 485.7.229-r318-tab2',
          'المتجر الثاني — قاعدة مستقلة • 485.7.229-r319-tab2',
          "R319 visible version")
gd=gradle.read_text(encoding="utf-8")
gd=once(gd,"versionName '485.7.229-r318-tab2'",
          "versionName '485.7.229-r319-tab2'","R319 Android version")
assert 'POS7_RESTORE_PENDING_R305' in html
assert 'window.pos310Installed=true' in html
assert 'window.pos311SaleActive' not in html
assert "function pos7R102SaveStateDirect()" in html
assert "window.pako.deflate(value,{level:1});" in html
assert html.count("pos319RepairDirty")>=4
assert html.count("pos319NewRows")>=3

assets.write_text(html,encoding="utf-8")
gradle.write_text(gd,encoding="utf-8")
print("R319 tab2 prepared: conditionally persist supplier repairs and accounting journal deltas")
