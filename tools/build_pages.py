"""Publish the unchanged solver UI with an exact-match archive adapter for GitHub Pages."""
from pathlib import Path
import gzip
import hashlib
import json
import re
import shutil

root = Path(__file__).resolve().parents[1]
public = root / "docs"
static = public / "static"
prefix = "/bioenergy-station/static/"
static.mkdir(parents=True, exist_ok=True)
modules = ["engine", "trace", "system", "calibration", "estimation"]
routes = {"/"+key: prefix+key+".html" for key in modules}
routes.update({"/": prefix+"index.html", "/#plant": prefix+"index.html#plant"})
for source in (root/"webdemo/static").rglob("*"):
    if not source.is_file():
        continue
    rel = source.relative_to(root/"webdemo/static")
    target = static / rel
    target.parent.mkdir(exist_ok=True, parents=True)
    if source.suffix not in {".js", ".html", ".css"} or ".min." in source.name:
        shutil.copyfile(source, target)
        continue
    s = source.read_text(encoding="utf-8")
    s = s.replace("/static/", prefix)
    if source.suffix == ".html":
        s = re.sub(r'(href=")(/[^"]*)(")', lambda m: m[1]+routes.get(m[2],m[2])+m[3], s)
        s = re.sub(r'(<meta charset=["\']utf-8["\']\s*/?>)',lambda m: m[0]+f'<script src="{prefix}pages-client.js"></script>',s,count=1,flags=re.I)
    if str(rel.as_posix()) == "station/index.html":
        s = s.replace("模型仿真 · 非实测","公开演示 · 求解记录 · 非实测")
        s = s.replace("点原料或拖到投料区，每次增加 1 m³/d。","已收录青贮 11.4、12.4、13.4 m³/d 的 30、150、300 天轨迹。猪粪 6.1、牛粪 5.0 m³/d，42 °C，其余保持默认。")
        s = s.replace("锁定配方并运行 →","锁定配方并读取记录 →")
        s = s.replace("烟台研究院 <span>/ 生物质与能源</span>","烟台研究院 <span>/ 公开演示 · 已求解工况</span>")
    if source.name == "station.js":
        for old,new in [("求解中…","读取记录中…"),("锁定配方并运行 →","锁定配方并读取记录 →"),("正在求解整段轨迹","正在读取匹配的求解记录"),("已完成 · 求解耗时","已载入 · 原运行耗时")]:
            s=s.replace(old,new)
    if source.name == "workbench.js":
        for src,dest in routes.items():
            s=s.replace(':"'+src+'"',':"'+dest+'"')
        s=s.replace('url.pathname==="/"',f'url.pathname==="{prefix}index.html"').replace('url.pathname.slice(1)','url.pathname.split("/").pop().replace(/\\.html$/,"")')
    target.write_text(s, encoding="utf-8")
shutil.copyfile(root/"tools/pages-client.js",static/"pages-client.js")
records = root/"published-records"
for r in json.loads((records/"index.json").read_text(encoding="utf-8")):
    raw=gzip.decompress((records/r["file"]).read_bytes())
    assert hashlib.sha256(raw).hexdigest()==r["sha256"]
    result=json.loads(raw)
    assert result.get("ok",True) and result.get("type")!="error", r["url"]
shutil.copytree(records, public/"records",dirs_exist_ok=True)
(public/".nojekyll").touch()
(public/"index.html").write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>生物能源试验站</title><meta http-equiv="refresh" content="0;url=./static/station/index.html"><a href="./static/station/index.html">进入生物能源试验站</a></html>', encoding="utf-8")
