"""Build the page from scripts/index.src.html.
  index.html    - full page for GitHub Pages (inlines the Leaflet stylesheet)
  artifact.html - same page without the document wrapper, for claude.ai previews"""
import os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, "..")
body = open(os.path.join(here, "index.src.html"), encoding="utf-8").read()
body = body.replace("/*LEAFLET_CSS*/", open(os.path.join(here, "leaflet.css"), encoding="utf-8").read())
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n')
i = body.index("</style>", body.index(":root{")) + len("</style>")
full = head + body[:i] + "\n</head>\n<body>\n" + body[i:] + "\n</body>\n</html>\n"
open(os.path.join(root, "index.html"), "w", encoding="utf-8").write(full)
open(os.path.join(here, "artifact.html"), "w", encoding="utf-8").write(body)
print("built index.html and scripts/artifact.html")
