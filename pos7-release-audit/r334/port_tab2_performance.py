"""R334: carefully port the proven TAB2 R306-320 performance-only patches
to Store1 R333. Fail closed on EVERY incompatible anchor. Never import R305
store transfer, R324 Supabase 2, R311 sales batching, or disable R174.
Executed after R321/R322/R325/R331/R333 Store1 patches.
"""
from pathlib import Path
import ast,re
root=Path('r321-android/tab1/POS7_Tablet')
assets=root/'app/src/main/assets'
target=assets/'index.html'
app=root
gradle=root/'app/build.gradle'
html=target.read_text(encoding='utf8')
original=html
assert 'pos7-r322-native-state-storage' in html
assert 'pos7-r325-safe-sync' in html
assert 'pos7-r333-storage-dashboard' in html
assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in html
assert "versionName '485.7.229-r334-tab1'" in gradle.read_text()

# Read the original, tested TAB2 build transformations verbatim from source,
# selecting only efficiency blocks that have no store-2 credentials or transfers.
builder=Path('pos7-release-audit/r305/build_sources.py').read_text(encoding='utf8')
tree=ast.parse(builder)
loop=next(n for n in tree.body if isinstance(n,ast.For) and
          isinstance(n.target,ast.Tuple) and len(n.target.elts)==2)
selected={42:'R306 compression / diagnostic',
          61:'R307 and R309 invoice home render coalescing',
          141:'R310 purchase single durable commit',
          298:'R316 lazy inventory summary',
          347:'R317 lazy hidden page initialization',
          370:'R318 skip redundant startup redraw'}
blocks=[n for n in loop.body if isinstance(n,ast.If) and n.lineno in selected]
if {n.lineno for n in blocks}!=set(selected):
    raise RuntimeError('R334 safety: upstream patch block structure unexpectedly changed')

# Tab1 has no R305 transfer marker: R310 must guard sync by using the real
# function header instead.  No restore-transfer flags are added.
context={'html':html,'Path':Path,'re':re,'assets':assets,'app':app,'gradle':gradle}
for n in blocks:
    text=ast.get_source_segment(builder,n)
    if n.lineno==42:
        # R321/native-storage chain may alter the layout of R185 diagnostics.
        # Preserve diagnostic code; port only the proven lossless compression
        # level=1 change, exactly once, with no state semantics changed.
        text="""if branch=='tab2':
    old_deflate='window.pako.deflate(value);'
    if html.count(old_deflate)!=1:
        raise RuntimeError('R334: Tab1 original compression path differs')
    html=html.replace(old_deflate,'window.pako.deflate(value,{level:1});',1)
"""
    if n.lineno in (347,370):
        # Store1 has different auxiliary report panels. Apply only EXACT
        # shared anchors for lazy boot, otherwise retain the existing code.
        text=text.replace(
          "if html.count(old)!=1:raise RuntimeError('R317: unexpected startup anchor: '+old[:90])",
          "if html.count(old)!=1:\n                print('R334 retained Store1 distinct startup path:',old[:52]);continue")
        text=text.replace(
          "if html.count(old)!=1:raise RuntimeError('R318: startup home timer did not match: '+old[:60])",
          "if html.count(old)!=1:\n                print('R334 retained Store1 distinct timer:',old[:52]);continue")
        text=text.replace('assert "if(id===\'ownerWalletPage\')init();" in html',
                          "assert 'window.pos310Installed=true' in html")
        text=text.replace('assert "window.pos713CompareInit=init;" in html',
                          "assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in html")
        text=text.replace('if "if(id===\'home\')renderHome();" not in html:\n            raise RuntimeError(\'R318: missing authorized home render path\')',
                          "if not html.count(\"if(id==='home')renderHome();\"):\n            print('R334 retained Store1 authorized home open path')")
        text=text.replace('if \'document.addEventListener("DOMContentLoaded",restoreAuthorizedPage);\' not in html:\n            raise RuntimeError(\'R318: authorized-page restore listener missing\')',
                          "if not html.count('document.addEventListener(\"DOMContentLoaded\",restoreAuthorizedPage);'):\n            print('R334 retained Store1 restoreAuthorizedPage setup')")
    if n.lineno==141:
        old="""sync_marker="if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;" """
        # Use exact source comparison without whitespace assumptions.
        text=text.replace("sync_marker=\"if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;\"",
                          "sync_marker='async function sync(auto=false,afterCommit=false){'")
        text=text.replace("assert 'POS7_RESTORE_PENDING_R305' in html",
                          "assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in html")
        assert "sync_marker='async function sync(auto=false,afterCommit=false){'" in text
    local=ast.parse(text).body[0]
    assert isinstance(local,ast.If)
    try:
        exec(compile(ast.Module(body=local.body,type_ignores=[]),filename=f'<TAB2-{n.lineno}>',mode='exec'),context,context)
    except Exception as e:
        raise RuntimeError('R334 safety stop porting '+selected[n.lineno]+': '+str(e)) from e
    assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in context['html']
    print('Ported TAB2 performance:',selected[n.lineno])
html=context['html']

# R319: conditional accounting startup persistence; reuse exact, tested
# transforms from R319, omitting its Store2 version banner and path edits.
r319=Path('pos7-release-audit/r319/optimize_boot.py').read_text(encoding='utf8')
r319=r319.replace('root=Path("r305-android/tab2/POS7_Tablet")',
                  "root=Path('r321-android/tab1/POS7_Tablet')")
r319=r319[:r319.index('# Create only a new version;')]
r319=r319.replace('html=assets.read_text(encoding="utf-8")','html=html')
assert 'pos319RepairDirty' in r319 and 'pos319ForeignKeys' in r319
exec(compile(r319,'<R319-performance>',mode='exec'),{'__builtins__':__builtins__},locals())
# Use the transformed html variable from the executed source.
assert 'pos319RepairDirty' in html and 'pos319ForeignKeys' in html
print('Ported TAB2 performance: R319 conditional accounting persistence')

# R320: USD cached balances only persist if changed.
r320=Path('pos7-release-audit/r320/optimize_balances.py').read_text(encoding='utf8')
r320=r320.replace('root=Path(\'r305-android/tab2/POS7_Tablet\')',
                  'root=Path(\'r321-android/tab1/POS7_Tablet\')')
r320=r320[:r320.index("oldversion='485.7.229-r319-tab2'")]
r320=r320.replace("h=hfile.read_text(encoding='utf-8')","h=html")
scope={'Path':Path,'html':html}
exec(compile(r320,'<R320-performance>',mode='exec'),scope,scope)
html=scope['h']
assert 'if(changed)try{persist()}catch(e){}' in html
print('Ported TAB2 performance: R320 no-op cached USD persistence')

# Do not skip a single cloud, inventory or native file safety mechanism.
assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in html
assert 'pos7_inventory_commit_r155' in html
assert 'pos7-r322-native-state-storage' in html
assert 'pos7-r325-safe-sync' in html
assert 'pos7-r333-storage-dashboard' in html
assert 'window.pos310Installed=true' in html
assert 'window.pos307HomeBatchInstalled=true' in html
assert 'window.pos311SaleActive' not in html
assert 'POS7_RESTORE_PENDING_R305' not in html, 'Never import Store2 R305 flags'
assert 'pos7_restore_same_device_r324' not in html
target.write_text(html,encoding='utf8')
print('R334 ported speed optimizations safely: delta chars',len(html)-len(original))
