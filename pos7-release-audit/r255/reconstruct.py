"""Reconstruct R255 from the byte-verified R254 archive and exact release delta.
No application data or secrets are included. Verify the complete source tree before build.
"""
import base64, hashlib, struct, zlib, zipfile
from pathlib import Path
ROOT = 'POS7_Owner_Phone/'
HERE = Path(__file__).resolve().parent
BASE = Path('POS7_R254_PHONE_LOGOUT_BATCH_GUARD_SOURCE.zip')
OUT = Path('POS7_R255_PHONE_ANDROID_SOURCE.zip')
BASE_SHA = 'a75d39632673d3d888dfda6bdad0215b69d7605c1808dbbb37ca36dfd4fa0753'
TREE_SHA = 'a58d29c712b4f3e1eb5238e8b7a5f7d2d053e5d7989695c20ec80a4613e9c51e'
PATCHES = [["app/build.gradle","eNprYGB6zQAB7Ka6BRn5eakNDMxnGRiY/gMAShoGQg=="],["app/src/main/AndroidManifest.xml","eNprYGDYzwABMs6Ovq5BjkoK+nZcCkBgU1qcWqyblppYUlqU2sDAIA5UEwXEThmJRSnliUWpesmJualFiUoKiXkpRfmZKVZFqYWlmUWpKbZKaYk5xakIkwpLU4syU4vtbDLzSlLzSuyApskxMLCVA00zyE1NyUzUS0wuyczP0/P0dXR3jXd2DAgJDXIF6bfRh2qx0Yca0sDA8Qaorx0AE2U0mQ=="],["app/src/main/java/com/sokkarzeyedeh/pos7owner/MainActivity.java","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"],["test_r255.cjs","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"]]
def sha(data):
    return hashlib.sha256(data).hexdigest()
def tree(files):
    return sha(''.join(f'{sha(files[n])}  {n}\n' for n in sorted(files)).encode())
def readzip(path):
    with zipfile.ZipFile(path) as z:
        names=z.namelist()
        assert len(set(names))==len(names)
        assert z.testzip() is None
        return {n:z.read(n) for n in names}
def apply(old, encoded):
    data=zlib.decompress(base64.b64decode(encoded,validate=True))
    out=bytearray()
    i=0
    while i<len(data):
        size=struct.unpack_from('>I',data,i)[0]; i+=4
        if size & 0x80000000:
            size &= 0x7fffffff
            offset=struct.unpack_from('>I',data,i)[0]; i+=4
            assert offset+size<=len(old)
            out.extend(old[offset:offset+size])
        else:
            assert i+size<=len(data)
            out.extend(data[i:i+size]); i+=size
    assert i==len(data)
    return bytes(out)
def main():
    if OUT.exists():
        assert tree(readzip(OUT))==TREE_SHA, 'Uploaded source tree differs from reviewed R255'
        print('Existing R255 source tree verified.')
        return
    assert sha(BASE.read_bytes())==BASE_SHA, 'R254 base archive differs'
    files=readzip(BASE)
    for name, encoded in PATCHES:
        path=ROOT+name
        files[path]=apply(files.get(path,b''),encoded)
    files[ROOT+'app/src/main/assets/index.html']=(HERE/'index.html').read_bytes()
    files[ROOT+'.github/workflows/main.yml']=(HERE/'source-main.yml').read_bytes()
    assert tree(files)==TREE_SHA, 'Reconstructed source tree differs from reviewed R255'
    with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name in sorted(files):
            z.writestr(name,files[name])
    assert tree(readzip(OUT))==TREE_SHA
    print('Exact R255 source tree verified:',TREE_SHA)
if __name__=='__main__':
    main()
