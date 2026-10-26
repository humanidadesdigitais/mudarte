# Mudarte

Mudarte is a light archive for looking through pictures from Brazilian cultural collections and remixing one picture at a time in the browser.

This project derives from [Abre-te Código datasets](https://github.com/shawee-io/abrete-codigo-datasets). The pictures and the license records come from that collection.

## Archive

The main page lists the institutions that have pictures. Each card shows the institution, one cover picture, and a short description of what the pictures are. Choose an institution to open its pictures, then choose a picture.

## Remix

Opening a picture starts a session for that picture only. The drawing stays in the browser while you remain on it.

- Draw on top of the picture with the pen, the eraser, and the brush size.
- **Hide remix** turns your drawing off and on. Hiding it leaves the strokes in place.
- **Discard remix** clears the drawing and keeps you on the same picture.
- **Download** saves a PNG of the picture as it appears. The drawing is part of the file when the remix is visible.
- **Back**, the browser Back button, or Esc returns to that institution's pictures. That ends the session and discards the remix.

From an institution's pictures, Back or Esc returns to the institution list.

A remix lives only for the current visit to that picture. Leaving the picture drops it. Nothing is uploaded or stored on a server.

The studio shows the institution and the license. Credit the institution when the license asks for attribution. CC BY-SA and CC BY-NC-SA also set the terms for sharing a remix.

## Run

From the repository root:

```powershell
python -m pip install pillow
python app/build.py
python -m http.server 8000
```

Open http://localhost:8000/app/

`app/build.py` writes `app/catalog.js` and small JPEG previews in `app/thumbs/`. Those previews are local build files. Browsers cannot display the TIFF scans, so each TIFF also gets a JPEG preview for the studio. The original TIFF stays in `data/image`. Download saves the working view, with the longest side capped around 2000 pixels.

## Layout

- `app/` holds the page, its styles and scripts, and the catalog builder.
- `data/image/` holds the pictures, grouped by institution.
- `data/other/` holds spreadsheets, text, audio, and the license workbook.

Folder names are lowercase kebab-case. A collection that had a single inner folder keeps those files directly in the institution folder. Museu Histórico Nacional/Ibram keeps its five picture groups because that folder had several groups side by side.

The institution list includes only the collections in `data/image`. Files in `data/other` stay in the archive and do not appear on the page.

## Collections and licenses

| Institution | License | Pictures |
| --- | --- | --- |
| Museu de Arte Contemporânea da Universidade de São Paulo | PD - Domínio Público, a obra não é protegida por direitos autorais. | Yes |
| Museu Paulista da USP | PD - Domínio Público, a obra não é protegida por direitos autorais. | Yes |
