"""Render a specification page on demand without changing its extraction role."""
import sys
import fitz

with fitz.open(sys.argv[1]) as document:
    page = document[int(sys.argv[2]) - 1]
    scale = min(2, 1800 / max(page.rect.width, page.rect.height))
    page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).save(sys.argv[3])
