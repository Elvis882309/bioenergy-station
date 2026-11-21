"""Export real solver responses keyed by exact request. Run against the local full application."""
import gzip, hashlib, json
from copy import deepcopy
from pathlib import Path
from urllib.request import Request, urlopen

out = Path(__file__).resolve().parents[1] / "published-records"
out.mkdir(exist_ok=True)
index = []
def capture(url, body=None):
    req = Request("http://127.0.0.1:8848"+url, data=None if body is None else json.dumps(body).encode(), headers={"Content-Type":"application/json"})
    with urlopen(req, timeout=300) as res:
        raw=res.read()
    if "dashboard-stream" in url:
        event=json.loads(raw.splitlines()[-1])
        if event["type"]!="result": raise ValueError(event)
        raw=json.dumps(event,ensure_ascii=False,separators=(",",":")).encode()+b"\n"
    ident=hashlib.sha256(raw).hexdigest()
    file=ident[:20]+".gz"
    (out/file).write_bytes(gzip.compress(raw,mtime=0))
    index.append(dict(url=url,body=body,file=file,sha256=ident))
    (out/"index.json").write_text(json.dumps(index,ensure_ascii=False),encoding="utf8")
    print(url,len(raw),flush=True)
    if "dashboard-stream" not in url:return json.loads(raw)

meta=capture("/api/meta")
cfg=meta["defaults"]
lab=capture("/api/lab/meta")
for days in (30,150,300):
    for maize in (11.4,12.4,13.4):
        case=deepcopy(cfg);case.update(duration=days,temp_step_day=None,temp_step_delta_c=-5,max_points=3000)
        case["feed"][0]["q"]=maize
        capture("/api/trace",case)
case=deepcopy(cfg);case.update(temp_step_day=40,temp_step_delta_c=-5,max_points=900)
capture("/api/traces",case)
case=deepcopy(case);case["feed"][0]["q"]=12.4
capture("/api/trace",case)
case=deepcopy(case);case["feed"][0]["q"]=11.4;case["max_points"]=700
capture("/api/traces",case)
capture("/api/system?days=120")
capture("/api/dashboard-stream",cfg)
capture("/api/dashboard-stream?compare=true",cfg)
p=lab["parameters"][0]
capture("/api/calibration",dict(parameter=p["id"],truth=round(p["lo"]+.6*(p["hi"]-p["lo"]),4),start=p["default"],days=30,method="nelder_mead",max_iterations=30))
capture("/api/estimation",dict(hours=12,prior_scale=.6))

