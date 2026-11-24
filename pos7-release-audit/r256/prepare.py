from pathlib import Path
import base64,hashlib,zipfile,json
root='POS7_Owner_Phone/'
here=Path(__file__).resolve().parent
base=Path('POS7_R255_PHONE_ANDROID_SOURCE.zip')
out=Path('POS7_R256_PHONE_ANDROID_SOURCE.zip')
sha=lambda b:hashlib.sha256(b).hexdigest()
with zipfile.ZipFile(base) as z:
    assert z.testzip() is None
    data={n:z.read(n) for n in z.namelist()}
def tree(data):
    return sha(''.join(f'{sha(data[n])}  {n}\n' for n in sorted(data)).encode())
assert tree(data)=='a58d29c712b4f3e1eb5238e8b7a5f7d2d053e5d7989695c20ec80a4613e9c51e'
data.pop(root+'test_r255.cjs')
side=json.loads((here/'overlay.json').read_text())
for name,encoded in side.items():
    data[root+name]=base64.b64decode(encoded,validate=True)
data[root+'app/src/main/assets/index.html']=(here/'index.html').read_bytes()
assert tree(data)=='f56eab5ecfdaca51a4d9fe03020c30389432febdc46e3232e98432e83aaba20a', 'R256 complete tree differs from tested source'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for n in sorted(data):z.writestr(n,data[n])
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert tree({n:z.read(n) for n in z.namelist()})=='f56eab5ecfdaca51a4d9fe03020c30389432febdc46e3232e98432e83aaba20a'
print('Verified complete R256 tree:','f56eab5ecfdaca51a4d9fe03020c30389432febdc46e3232e98432e83aaba20a')
